// One-click static export ("Convert to Static Website"): runs `npm install` + `npm run build:static` inside the generated
// site folder and zips out/ for download. One build per project at a time.
// ponytail: job state is in memory (lost on backend restart, single instance only);
// move to a BullMQ job if builds must survive restarts or run on several instances.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { sitesDir, withSiteLock } from './generator.js';

const jobs = new Map(); // slug -> { state, log, startedAt, finishedAt }
const LOG_LINES = 40;
// A build runs the site's dependencies' code. Only this many at once across ALL projects (each is CPU and RAM heavy),
// and none may run longer than the timeout.
const MAX_CONCURRENT_BUILDS = () => Math.max(1, Number(process.env.STATIC_BUILD_MAX) || 1);
const BUILD_TIMEOUT_MS = () => Number(process.env.STATIC_BUILD_TIMEOUT_MS) || 15 * 60 * 1000;

// The build subprocess gets ONLY these variables. It used to inherit the backend's whole environment: the JWT secrets,
// database and Redis passwords, MinIO and API keys, readable by any npm package script or by the site's own build code.
const SAFE_ENV_KEYS = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'TERM', 'TZ', 'SSL_CERT_FILE', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY'];
export const buildEnv = (extra = {}) => ({
  ...Object.fromEntries(SAFE_ENV_KEYS.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]])),
  ...extra,
});

const runningCount = () => [...jobs.values()].filter((j) => j.state === 'running').length;

const siteRoot = (slug) => path.join(sitesDir(), slug);

export const getStaticBuild = (slug) => jobs.get(slug) ?? { state: 'idle', log: '' };

function run(cmd, args, cwd, env, job) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: buildEnv(env) });
    const timer = setTimeout(() => {
      job.log += '\nBuild timed out and was stopped.';
      p.kill('SIGKILL');
    }, BUILD_TIMEOUT_MS());
    p.on('close', () => clearTimeout(timer));
    const push = (d) => {
      job.log = (job.log + d).split('\n').slice(-LOG_LINES).join('\n');
    };
    p.stdout.on('data', push);
    p.stderr.on('data', push);
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))
    );
  });
}

/**
 * Starts a build. Returns true, or the reason it did not start: 'running' (this project already has one) or
 * 'busy' (the global limit is reached). `exec` is injectable for tests.
 */
export function startStaticBuild(slug, { apiBase = '', contact = {}, tokens = null, exec = run } = {}) {
  if (jobs.get(slug)?.state === 'running') return 'running';
  if (runningCount() >= MAX_CONCURRENT_BUILDS()) return 'busy';
  // `folder` is where the finished site appears on the host: SITES_DIR is the bind mount of
  // frontend/projects (docker-compose.yml), so the user can copy it straight from their machine.
  const job = {
    state: 'running',
    log: '',
    startedAt: Date.now(),
    slug,
    folder: `frontend/projects/${slug}/out`,
  };
  jobs.set(slug, job);
  const root = siteRoot(slug);
  // next build must run with NODE_ENV=production whatever the host process uses (dev containers set
  // 'development', which breaks prerendering of /404 with an <Html> import error).
  // NEXT_PUBLIC_STATIC_SITE tells the site's own code it has no server of its own: a form then shows the
  // company's contact details (passed here from Application Identity) instead of a form that cannot send,
  // unless a backend address was given.
  const env = {
    NODE_ENV: 'production',
    NEXT_PUBLIC_STATIC_SITE: '1',
    NEXT_PUBLIC_CONTACT_EMAIL: contact.email ?? '',
    NEXT_PUBLIC_CONTACT_PHONE: contact.phone ?? '',
    // Which theme the site opens in (dark, light or follow the visitor's system), as saved in the admin.
    NEXT_PUBLIC_THEME_ACTIVE: tokens?.activeTheme ?? 'system',
    ...(apiBase ? { NEXT_PUBLIC_API_BASE: apiBase } : {}),
  };
  // Held for the whole build: a regeneration (triggered by any admin edit) must not rewrite the
  // folder while it is being copied, and vice versa. Edits made meanwhile are picked up by the next
  // regeneration once the build finishes.
  withSiteLock(slug, async () => {
    try {
      // The theme (colours, fonts, spacing) is written into the folder as plain CSS, so the finished
      // site never asks a server for it. build-static.mjs copies static-assets/ into the site root.
      if (tokens?.css) {
        await fs.promises.mkdir(path.join(root, 'static-assets'), { recursive: true });
        await fs.promises.writeFile(path.join(root, 'static-assets', 'th-tokens.css'), tokens.css);
      }
      // --ignore-scripts: no dependency may run an install/postinstall script. Next ships its compiler as a prebuilt package.
      await exec('npm', ['install', '--include=dev', '--no-audit', '--no-fund', '--ignore-scripts'], root, {}, job);
      await exec('npm', ['run', 'build:static'], root, env, job);
      if (!fs.existsSync(path.join(root, 'out', 'index.html')))
        throw new Error('build produced no out/index.html');
      job.state = 'done';
    } catch (e) {
      job.state = 'failed';
      job.log += `\n${e.message}`;
    } finally {
      job.finishedAt = Date.now();
    }
  });
  return true;
}

/** Zip of the last successful build, or null. */
export function zipStaticBuild(slug) {
  if (jobs.get(slug)?.state !== 'done') return null;
  const zip = new AdmZip();
  zip.addLocalFolder(path.join(siteRoot(slug), 'out'));
  return zip.toBuffer();
}
