import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from '../../config/database.js';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../prisma/migrations');

/** Host, port, database and user from DATABASE_URL: never the password. */
export function describeDatabaseUrl(url = process.env.DATABASE_URL) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || '5432',
      database: decodeURIComponent(u.pathname.replace(/^\//, '')),
      user: decodeURIComponent(u.username),
    };
  } catch {
    return { host: '', port: '', database: '', user: '' };
  }
}

// An error message must never leak the connection string.
const scrub = (msg) => String(msg ?? '').replace(/postgres(ql)?:\/\/[^\s'"]+/gi, 'postgresql://***').slice(0, 300);

/**
 * Installer step 1: is the database reachable, and are the migrations applied? The connection itself comes
 * from the server's environment (DATABASE_URL), so this is a test, not a form: rewriting server credentials
 * from a web page, before anyone is signed in, would be unsafe.
 */
export async function databaseStatus(db = prisma, { url = process.env.DATABASE_URL, migrationsDir = MIGRATIONS_DIR } = {}) {
  const target = describeDatabaseUrl(url);
  try {
    const [info] = await db.$queryRaw`SELECT version() AS version, current_database() AS database`;
    const files = existsSync(migrationsDir)
      ? readdirSync(migrationsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
      : [];
    const rows = await db.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
    const applied = new Set(rows.filter((r) => r.finished_at && !r.rolled_back_at).map((r) => r.migration_name));
    const failed = rows.filter((r) => !r.finished_at && !r.rolled_back_at).map((r) => r.migration_name);
    const pending = files.filter((f) => !applied.has(f));
    return {
      connected: true,
      ...target,
      server: String(info?.version ?? '').split(' ').slice(0, 2).join(' '),
      migrations: { total: files.length, applied: files.length - pending.length, pending: pending.length, failed: failed.length },
      ready: pending.length === 0 && failed.length === 0,
    };
  } catch (err) {
    return { connected: false, ...target, error: scrub(err.message), ready: false };
  }
}
