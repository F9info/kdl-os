/**
 * S7: the static export builds a site by running npm and the site's dependencies on the API host.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

vi.mock('../../src/config/database.js', () => ({ prisma: {} }));
vi.mock('../../src/config/redis.js', () => ({ redis: { incr: vi.fn(), pexpire: vi.fn(), pttl: vi.fn() } }));

import { startStaticBuild, getStaticBuild, buildEnv } from '../../src/modules/template-engine/site/static-build.js';
import { checkApiBase } from '../../src/modules/template-engine/controller.js';
import { readFileSync } from 'node:fs';

describe('build environment', () => {
  it('does not pass the backend secrets to the build, only a short safe list', () => {
    process.env.JWT_SECRET = 'x'.repeat(40);
    process.env.DATABASE_URL = 'postgres://u:p@h/db';
    process.env.MINIO_SECRET_KEY = 'minio-secret';
    process.env.ANTHROPIC_API_KEY = 'sk-leak';
    const env = buildEnv({ NODE_ENV: 'production', NEXT_PUBLIC_STATIC_SITE: '1' });
    for (const k of ['JWT_SECRET', 'DATABASE_URL', 'MINIO_SECRET_KEY', 'ANTHROPIC_API_KEY', 'JWT_REFRESH_SECRET', 'REDIS_URL'])
      expect(env).not.toHaveProperty(k);
    expect(env.NEXT_PUBLIC_STATIC_SITE).toBe('1');
    expect(env.PATH).toBeTruthy(); // npm still needs to find node
  });
});

describe('npm install', () => {
  it('runs with --ignore-scripts', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-s7-'));
    process.env.SITES_DIR = dir;
    await fs.mkdir(path.join(dir, 's7a'));
    const calls = [];
    const exec = async (cmd, args, cwd) => {
      calls.push(args);
      if (args[0] === 'run') {
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), 'x');
      }
    };
    startStaticBuild('s7a', { exec });
    for (let i = 0; i < 50 && getStaticBuild('s7a').state === 'running'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(calls[0]).toContain('--ignore-scripts');
    delete process.env.SITES_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });
});

describe('global build limit', () => {
  let dir;
  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-s7-'));
    process.env.SITES_DIR = dir;
    delete process.env.STATIC_BUILD_MAX;
  });
  afterEach(async () => {
    delete process.env.SITES_DIR;
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('a second project cannot start while the limit (1) is in use, and can once the first ends', async () => {
    await fs.mkdir(path.join(dir, 'p1'));
    await fs.mkdir(path.join(dir, 'p2'));
    let release;
    const gate = new Promise((r) => (release = r));
    const slow = async (cmd, args, cwd) => {
      await gate;
      if (args[0] === 'run') {
        await fs.mkdir(path.join(cwd, 'out'), { recursive: true });
        await fs.writeFile(path.join(cwd, 'out', 'index.html'), 'x');
      }
    };
    expect(startStaticBuild('p1', { exec: slow })).toBe(true);
    expect(startStaticBuild('p2', { exec: slow })).toBe('busy');
    expect(startStaticBuild('p1', { exec: slow })).toBe('running');
    release();
    for (let i = 0; i < 100 && getStaticBuild('p1').state === 'running'; i++) await new Promise((r) => setTimeout(r, 10));
    expect(startStaticBuild('p2', { exec: async () => {} })).toBe(true);
  });
});

describe('apiBase', () => {
  const bad = (v) => expect(checkApiBase(v).ok).toBe(false);
  it('accepts a public https address and normalises it', () => {
    expect(checkApiBase('https://api.example.com/v1/')).toEqual({ ok: true, value: 'https://api.example.com/v1' });
    expect(checkApiBase('')).toEqual({ ok: true, value: undefined });
  });
  it('rejects other schemes, credentials and internal hosts', () => {
    ['http://api.example.com', 'javascript:alert(1)', 'ftp://x.com', 'file:///etc/passwd', 'not a url',
      'https://user:pw@api.example.com', 'https://localhost:4000', 'https://127.0.0.1', 'https://10.0.0.5',
      'https://192.168.1.2', 'https://169.254.169.254/latest', 'https://172.20.0.1', 'https://db.internal'].forEach(bad);
  });
  it('honours STATIC_API_BASE_ALLOWLIST', () => {
    process.env.STATIC_API_BASE_ALLOWLIST = 'api.mycompany.com, forms.mycompany.com';
    expect(checkApiBase('https://api.mycompany.com').ok).toBe(true);
    bad('https://evil.example.com');
    delete process.env.STATIC_API_BASE_ALLOWLIST;
  });
});

describe('routes and audit', () => {
  const read = (f) => readFileSync(new URL(`../../src/modules/template-engine/${f}`, import.meta.url), 'utf8');
  it('starting an export needs the export permission and is rate limited per person', () => {
    expect(read('routes.js')).toMatch(/router\.post\('\/site\/static', requirePermission\('template-engine', 'export'\), staticBuildLimiter/);
  });
  it('start and download are audit logged', () => {
    const c = read('controller.js');
    expect(c).toContain("action: 'static_export_started'");
    expect(c).toContain("action: 'static_export_downloaded'");
  });
});
