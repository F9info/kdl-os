import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

vi.mock('../../../config/database.js', () => ({ prisma: {} }));

import { startStaticBuild, getStaticBuild, zipStaticBuild } from './static-build.js';
import { withSiteLock, writeSite, buildSiteModel } from './generator.js';

const until = async (slug, state) => {
  for (let i = 0; i < 50 && getStaticBuild(slug).state !== state; i++)
    await new Promise((r) => setTimeout(r, 10));
  return getStaticBuild(slug);
};

describe('one-click static build job', () => {
  let dir;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-sb-'));
    process.env.SITES_DIR = dir;
  });
  afterEach(async () => {
    delete process.env.SITES_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('marks the build as a static site, passes the contact details, and reports its folder', async () => {
    let buildEnv = null;
    const exec = async (cmd, args, cwd, env) => {
      if (args[0] === 'run') {
        buildEnv = env;
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    await fs.mkdir(path.join(dir, 'meta'));
    startStaticBuild('meta', { contact: { email: 'info@kdl.com', phone: '7337337778' }, exec });
    expect(getStaticBuild('meta')).toMatchObject({ slug: 'meta', folder: 'frontend/projects/meta/out' });
    await until('meta', 'done');
    expect(buildEnv).toMatchObject({
      NEXT_PUBLIC_STATIC_SITE: '1',
      NEXT_PUBLIC_CONTACT_EMAIL: 'info@kdl.com',
      NEXT_PUBLIC_CONTACT_PHONE: '7337337778',
    });
    expect(buildEnv.NEXT_PUBLIC_API_BASE).toBeUndefined();
    expect(getStaticBuild('meta').folder).toBe('frontend/projects/meta/out');
  });

  it('writes the theme CSS into static-assets before building, and passes the active theme', async () => {
    let seen = null;
    let env = null;
    const exec = async (cmd, args, cwd, e) => {
      if (args[0] === 'run') {
        seen = await fs.readFile(path.join(cwd, 'static-assets', 'th-tokens.css'), 'utf8');
        env = e;
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    await fs.mkdir(path.join(dir, 'themed'));
    startStaticBuild('themed', { tokens: { css: ':root{--x:1}', activeTheme: 'light' }, exec });
    await until('themed', 'done');
    expect(seen).toBe(':root{--x:1}');
    expect(env.NEXT_PUBLIC_THEME_ACTIVE).toBe('light');
  });

  it('without tokens it writes no theme file and lets the site follow the visitor system theme', async () => {
    let env = null;
    const exec = async (cmd, args, cwd, e) => {
      if (args[0] === 'run') {
        env = e;
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    await fs.mkdir(path.join(dir, 'plain'));
    startStaticBuild('plain', { exec });
    await until('plain', 'done');
    expect(env.NEXT_PUBLIC_THEME_ACTIVE).toBe('system');
    await expect(fs.stat(path.join(dir, 'plain', 'static-assets', 'th-tokens.css'))).rejects.toThrow();
  });

  it('without contact details the build still gets empty values (nothing undefined in the env)', async () => {
    let buildEnv = null;
    const exec = async (cmd, args, cwd, env) => {
      if (args[0] === 'run') {
        buildEnv = env;
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    await fs.mkdir(path.join(dir, 'bare'));
    startStaticBuild('bare', { exec });
    await until('bare', 'done');
    expect(buildEnv.NEXT_PUBLIC_CONTACT_EMAIL).toBe('');
    expect(buildEnv.NEXT_PUBLIC_CONTACT_PHONE).toBe('');
  });

  it('runs install then build, passes apiBase, and zips out/', async () => {
    const calls = [];
    const exec = async (cmd, args, cwd, env) => {
      calls.push([args.join(' '), env.NEXT_PUBLIC_API_BASE, env.NODE_ENV]);
      if (args[0] === 'run') {
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    await fs.mkdir(path.join(dir, 'ok'));
    expect(startStaticBuild('ok', { apiBase: 'https://api.example.com', exec })).toBe(true);
    expect((await until('ok', 'done')).state).toBe('done');
    expect(calls).toEqual([
      ['install --include=dev --no-audit --no-fund', undefined, undefined],
      ['run build:static', 'https://api.example.com', 'production'],
    ]);
    const names = new AdmZip(zipStaticBuild('ok')).getEntries().map((e) => e.entryName);
    expect(names).toContain('index.html');
  });

  it('reports failure, keeps a log, offers no zip, and rejects a concurrent start', async () => {
    await fs.mkdir(path.join(dir, 'bad'));
    let release;
    const exec = () => new Promise((_, rej) => (release = () => rej(new Error('boom'))));
    expect(startStaticBuild('bad', { exec })).toBe(true);
    expect(startStaticBuild('bad', { exec })).toBe(false);
    await new Promise((r) => setTimeout(r, 0)); // exec starts once the site lock is entered
    release();
    const s = await until('bad', 'failed');
    expect(s.state).toBe('failed');
    expect(s.log).toContain('boom');
    expect(zipStaticBuild('bad')).toBeNull();
  });

  it('withSiteLock serializes work per site, keeps order, and continues after a failure', async () => {
    const order = [];
    const slow = withSiteLock('lock-a', async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push('first');
      throw new Error('boom');
    });
    const second = withSiteLock('lock-a', async () => order.push('second'));
    const other = withSiteLock('lock-b', async () => order.push('other-site'));
    await expect(slow).rejects.toThrow('boom');
    await second;
    await other;
    expect(order.indexOf('other-site')).toBeLessThan(order.indexOf('first')); // different site: not blocked
    expect(order.filter((x) => x !== 'other-site')).toEqual(['first', 'second']);
  });

  it('a static build never starts while the site folder is being regenerated (ENOENT race)', async () => {
    const model = buildSiteModel({
      project: { id: 'p1', name: 'Demo', slug: 'racy' },
      kit: null,
      company: {},
      pages: [{ id: 'a', title: 'Home', slug: 'te-p1-home', data: { content: [], root: {} } }],
      menus: [],
    });
    await writeSite(model); // folder exists with src/ from a previous generation
    const layout = path.join(dir, 'racy', 'src', 'app', 'layout.tsx');
    let regenDone = false;
    const seen = [];
    const exec = async (_c, args, cwd) => {
      // What the build needs at each step: regeneration finished AND the folder complete.
      seen.push({
        regenDone,
        layout: await fs.access(layout).then(
          () => true,
          () => false
        ),
      });
      if (args[0] === 'run') {
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), '<html></html>');
      }
    };
    // Regeneration (any admin edit) and the build start in the same tick; writeSite deletes src/ first.
    const regen = writeSite(model).then(() => {
      regenDone = true;
    });
    expect(startStaticBuild('racy', { exec })).toBe(true);
    await regen;
    expect((await until('racy', 'done')).state).toBe('done');
    expect(seen).toEqual([
      { regenDone: true, layout: true },
      { regenDone: true, layout: true },
    ]);
  });
});
