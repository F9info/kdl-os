// One-click static export: runs `npm install` + `npm run build:static` inside the generated
// site folder and zips out/ for download. One build per project at a time.
// ponytail: job state is in memory (lost on backend restart, single instance only);
// move to a BullMQ job if builds must survive restarts or run on several instances.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { sitesDir } from './generator.js';

const jobs = new Map(); // slug -> { state, log, startedAt, finishedAt }
const LOG_LINES = 40;

const siteRoot = (slug) => path.join(sitesDir(), slug);

export const getStaticBuild = (slug) => jobs.get(slug) ?? { state: 'idle', log: '' };

function run(cmd, args, cwd, env, job) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, env: { ...process.env, ...env } });
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

/** Starts a build; returns false if one is already running for this slug. `exec` is injectable for tests. */
export function startStaticBuild(slug, { apiBase = '', exec = run } = {}) {
  if (jobs.get(slug)?.state === 'running') return false;
  const job = { state: 'running', log: '', startedAt: Date.now() };
  jobs.set(slug, job);
  const root = siteRoot(slug);
  // next build must run with NODE_ENV=production whatever the host process uses (dev containers set
  // 'development', which breaks prerendering of /404 with an <Html> import error).
  const env = { NODE_ENV: 'production', ...(apiBase ? { NEXT_PUBLIC_API_BASE: apiBase } : {}) };
  (async () => {
    try {
      await exec('npm', ['install', '--include=dev', '--no-audit', '--no-fund'], root, {}, job);
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
  })();
  return true;
}

/** Zip of the last successful build, or null. */
export function zipStaticBuild(slug) {
  if (jobs.get(slug)?.state !== 'done') return null;
  const zip = new AdmZip();
  zip.addLocalFolder(path.join(siteRoot(slug), 'out'));
  return zip.toBuffer();
}
