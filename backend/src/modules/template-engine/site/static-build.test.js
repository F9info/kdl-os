import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

vi.mock('../../../config/database.js', () => ({ prisma: {} }));

import { startStaticBuild, getStaticBuild, zipStaticBuild } from './static-build.js';

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
    release();
    const s = await until('bad', 'failed');
    expect(s.state).toBe('failed');
    expect(s.log).toContain('boom');
    expect(zipStaticBuild('bad')).toBeNull();
  });
});
