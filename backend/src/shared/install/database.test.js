import { describe, it, expect, vi } from 'vitest';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
const { databaseStatus, describeDatabaseUrl } = await import('./database.js');

const dir = mkdtempSync(join(tmpdir(), 'mig-'));
for (const n of ['001_a', '002_b', '003_c']) mkdirSync(join(dir, n));
const url = 'postgresql://kdl:s3cret@db.internal:5433/kdlapp?schema=public';
const fake = (rows, versionRow = { version: 'PostgreSQL 15.4 on x86', database: 'kdlapp' }) => ({
  $queryRaw: vi.fn(async (strings) => (String(strings[0]).includes('version()') ? [versionRow] : rows)),
});

describe('describeDatabaseUrl', () => {
  it('returns host, port, database and user, never the password', () => {
    const d = describeDatabaseUrl(url);
    expect(d).toEqual({ host: 'db.internal', port: '5433', database: 'kdlapp', user: 'kdl' });
    expect(JSON.stringify(d)).not.toContain('s3cret');
    expect(describeDatabaseUrl('not a url')).toEqual({ host: '', port: '', database: '', user: '' });
  });
});

describe('databaseStatus', () => {
  it('reports connected and ready when every migration is applied', async () => {
    const done = (n) => ({ migration_name: n, finished_at: new Date(), rolled_back_at: null });
    const r = await databaseStatus(fake([done('001_a'), done('002_b'), done('003_c')]), { url, migrationsDir: dir });
    expect(r).toMatchObject({ connected: true, ready: true, host: 'db.internal', server: 'PostgreSQL 15.4' });
    expect(r.migrations).toEqual({ total: 3, applied: 3, pending: 0, failed: 0 });
    expect(JSON.stringify(r)).not.toContain('s3cret');
  });

  it('counts pending and failed migrations and is not ready', async () => {
    const rows = [
      { migration_name: '001_a', finished_at: new Date(), rolled_back_at: null },
      { migration_name: '002_b', finished_at: null, rolled_back_at: null },
    ];
    const r = await databaseStatus(fake(rows), { url, migrationsDir: dir });
    expect(r.migrations).toEqual({ total: 3, applied: 1, pending: 2, failed: 1 });
    expect(r.ready).toBe(false);
  });

  it('on a connection error answers connected:false and scrubs the connection string', async () => {
    const broken = { $queryRaw: vi.fn(async () => { throw new Error(`Can't reach postgresql://kdl:s3cret@db.internal:5433/kdlapp`); }) };
    const r = await databaseStatus(broken, { url, migrationsDir: dir });
    expect(r.connected).toBe(false);
    expect(r.error).not.toContain('s3cret');
    expect(r.error).toContain('postgresql://***');
    expect(r.host).toBe('db.internal');
  });
});
