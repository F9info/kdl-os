/**
 * S4: secret scanning and CI supply chain. Reads the real workflow files and runs the real scanner.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const wfDir = join(root, '.github/workflows');
const workflows = readdirSync(wfDir).filter((f) => f.endsWith('.yml')).map((f) => [f, readFileSync(join(wfDir, f), 'utf8')]);

describe('workflows', () => {
  it.each(workflows)('%s: every action is pinned to a commit SHA', (_f, src) => {
    const unpinned = [...src.matchAll(/^\s*(?:- )?uses: (\S+)/gm)].map((m) => m[1]).filter((u) => !/@[0-9a-f]{40}$/.test(u) && !u.startsWith('./'));
    expect(unpinned).toEqual([]);
  });

  it.each(workflows)('%s: sets token permissions (top level or per job)', (_f, src) => {
    expect(src).toMatch(/^\s*permissions:/m);
  });

  it.each(workflows)('%s: no stray text at column 0 (it would make the file invalid YAML)', (_f, src) => {
    // billing-check.yml once had issue text at column 0 inside `run: |`: invalid YAML, so the workflow never ran.
    const stray = src.split('\n').filter((l) => /^\S/.test(l) && !/^([\w-]+:|#|---)/.test(l));
    expect(stray).toEqual([]);
  });

  it('a secret-scan workflow exists and runs the shared script', () => {
    expect(readFileSync(join(wfDir, 'secret-scan.yml'), 'utf8')).toContain('scripts/secret-scan.mjs');
  });
});

describe('pre-commit hook', () => {
  it('runs the secret scan on staged files before lint-staged', () => {
    const hook = readFileSync(join(root, '.husky/pre-commit'), 'utf8');
    expect(hook.indexOf('secret-scan.mjs --staged')).toBeGreaterThanOrEqual(0);
    expect(hook.indexOf('secret-scan.mjs')).toBeLessThan(hook.indexOf('lint-staged'));
  });
});

describe('scripts/secret-scan.mjs', () => {
  const scan = (files) => {
    const dir = mkdtempSync(join(tmpdir(), 'scan-'));
    const git = (...a) => execFileSync('git', a, { cwd: dir });
    git('init', '-q');
    for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
    git('add', '.');
    const r = spawnSync('node', [join(root, 'scripts/secret-scan.mjs'), '--staged'], { cwd: dir, encoding: 'utf8' });
    return { code: r.status, out: r.stderr + r.stdout };
  };

  it('blocks a private key, an AWS key, a random value in a secret variable, an env file and a SQL dump', () => {
    const fakeAws = 'AKIA' + 'ABCDEFGHIJKLMNOP';
    const r = scan({
      'a.txt': `k=${fakeAws}\n`,
      'b.txt': 'DB_PASSWORD=Zq8vK2mXp9LrT4wYh7NcB3dF\n',
      'c.txt': '-----BEGIN RSA ' + 'PRIVATE KEY-----\n',
      '.env': 'A=1\n',
      'dump.sql': 'select 1;\n',
    });
    expect(r.code).toBe(1);
    for (const w of ['AWS access key', 'secret-named variable', 'private key', 'environment file', 'database dump']) expect(r.out).toContain(w);
  });

  it('allows placeholders, .env.example and an explicit allow marker', () => {
    const r = scan({
      '.env.example': 'JWT_SECRET=change_this_min_64_chars\nDATABASE_URL=postgresql://postgres:change_this@localhost/db\n',
      'doc.md': 'JWT_SECRET=Zq8vK2mXp9LrT4wYh7NcB3dF # secret-scan:allow\n',
    });
    expect(r.code).toBe(0);
  });

  it('the repository itself is clean', () => {
    const r = spawnSync('node', [join(root, 'scripts/secret-scan.mjs'), '--all'], { cwd: root, encoding: 'utf8' });
    expect(r.stdout + r.stderr).toMatch(/clean/);
    expect(r.status).toBe(0);
  });
});
