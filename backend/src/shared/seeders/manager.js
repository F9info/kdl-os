// Central seeder manager. One registry of seeders, each with a name, a version and the seeders it needs first.
// It runs them in dependency order, one transaction per seeder (a failed seeder leaves nothing half-written and
// stops the run), and keeps a run record and a capped log in app_settings (no table, no migration).
//
//   seeders.runs  { [name]: { version, status: 'done'|'failed'|'running', at, ms, error? } }   latest run of each
//   seeders.log   last 200 lines { at, seeder, level, message }
//
// Every seeder is idempotent, so the default is to run all of them (a code update may add rows). `pending: true`
// runs only the ones never run, failed, or whose version changed: bump `version` when a seeder's output changes.
// Module seeds (modules/<slug>/seed.js) run inside the module install transaction and are recorded the same way
// under `module:<slug>` through recordRun().
import { logger } from '../utils/logger.js';

export const RUNS_KEY = 'seeders.runs';
export const LOG_KEY = 'seeders.log';
export const MAX_LOG = 200;
export const TX_OPTIONS = { timeout: 180_000, maxWait: 10_000 }; // seeds can write thousands of rows (Prisma default is 5s)

const parse = (raw, fallback) => {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

async function readSetting(db, key) {
  return (await db.appSetting.findUnique({ where: { key } }))?.value ?? null;
}
async function writeSetting(db, key, value, description) {
  const v = JSON.stringify(value);
  await db.appSetting.upsert({
    where: { key },
    update: { value: v },
    create: { key, value: v, type: 'json', description, is_public: false },
  });
}

export const readRuns = async (db) => parse(await readSetting(db, RUNS_KEY), {});
export const readLog = async (db, limit = 60) => parse(await readSetting(db, LOG_KEY), []).slice(-limit);

/** Record one run (and log line). Works with the real client or a transaction client. */
export async function recordRun(db, name, { version = '1', status, ms = 0, error = null }) {
  const runs = await readRuns(db);
  runs[name] = { version: String(version), status, at: new Date().toISOString(), ms, ...(error ? { error: String(error).slice(0, 300) } : {}) };
  await writeSetting(db, RUNS_KEY, runs, 'Latest run of each seeder');
  const lines = parse(await readSetting(db, LOG_KEY), []);
  lines.push({
    at: runs[name].at,
    seeder: name,
    level: status === 'failed' ? 'error' : 'info',
    message: status === 'failed' ? `failed: ${runs[name].error}` : `${status} (v${runs[name].version}, ${ms}ms)`,
  });
  await writeSetting(db, LOG_KEY, lines.slice(-MAX_LOG), 'Seeder run log');
}

/**
 * Order seeders so every one comes after what it `dependsOn`, keeping the given order otherwise.
 * Throws on an unknown dependency, a duplicate name or a cycle: a broken registry must fail loudly at start.
 */
export function orderSeeders(seeders) {
  const byName = new Map();
  for (const s of seeders) {
    if (byName.has(s.name)) throw new Error(`Duplicate seeder "${s.name}"`);
    byName.set(s.name, s);
  }
  const out = [];
  const done = new Set();
  const visiting = new Set();
  const visit = (s) => {
    if (done.has(s.name)) return;
    if (visiting.has(s.name)) throw new Error(`Circular seeder dependency involving "${s.name}"`);
    visiting.add(s.name);
    for (const dep of s.dependsOn ?? []) {
      const d = byName.get(dep);
      if (!d) throw new Error(`Seeder "${s.name}" depends on unknown seeder "${dep}"`);
      visit(d);
    }
    visiting.delete(s.name);
    done.add(s.name);
    out.push(s);
  };
  seeders.forEach(visit);
  return out;
}

/** What would run, and why. Reads the run record only. */
export async function planSeeders(db, seeders, { only, pending = false } = {}) {
  const runs = await readRuns(db);
  const ordered = orderSeeders(seeders);
  const wanted = only ? withDependencies(ordered, only) : new Set(ordered.map((s) => s.name));
  return ordered
    .filter((s) => wanted.has(s.name))
    .map((s) => {
      const last = runs[s.name];
      const current = last?.status === 'done' && last.version === String(s.version ?? '1');
      return { name: s.name, version: String(s.version ?? '1'), description: s.description ?? '', last: last ?? null, current, run: !(pending && current) };
    });
}

function withDependencies(ordered, only) {
  const byName = new Map(ordered.map((s) => [s.name, s]));
  const keep = new Set();
  const add = (n) => {
    if (keep.has(n)) return;
    const s = byName.get(n);
    if (!s) throw new Error(`Unknown seeder "${n}"`);
    keep.add(n);
    (s.dependsOn ?? []).forEach(add);
  };
  [].concat(only).forEach(add);
  return keep;
}

/**
 * Run seeders in dependency order. Each runs in its own transaction and receives the transaction client.
 * Options: only (name or names, their dependencies come along), pending, onStep({name,status}), ctx (passed to run()).
 * Stops at the first failure (later seeders may depend on it), records it, and rethrows.
 */
export async function runSeeders(prisma, seeders, { only, pending = false, onStep = async () => {}, ctx = {} } = {}) {
  const plan = await planSeeders(prisma, seeders, { only, pending });
  const byName = new Map(seeders.map((s) => [s.name, s]));
  const ran = [];
  for (const item of plan) {
    if (!item.run) {
      await onStep({ name: item.name, status: 'skipped' });
      continue;
    }
    const seeder = byName.get(item.name);
    await onStep({ name: item.name, status: 'running' });
    const started = Date.now();
    try {
      // The run record is written in the same transaction, so "done" is never recorded for rolled-back work.
      const body = async (tx) => {
        await seeder.run(tx, ctx);
        await recordRun(tx, item.name, { version: item.version, status: 'done', ms: Date.now() - started });
      };
      if (seeder.transactional === false) {
        await body(prisma);
      } else {
        await prisma.$transaction(body, TX_OPTIONS);
      }
    } catch (err) {
      logger.error(`seeder ${item.name} failed: ${err.message}`);
      await recordRun(prisma, item.name, { version: item.version, status: 'failed', ms: Date.now() - started, error: err.message }).catch(() => {});
      throw Object.assign(err, { seeder: item.name });
    }
    ran.push(item.name);
    await onStep({ name: item.name, status: 'done' });
  }
  return ran;
}
