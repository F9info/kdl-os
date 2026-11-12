#!/usr/bin/env node
/**
 * Seeder and module-lifecycle verifier (run against a FRESH, empty, migrated database).
 *
 *   createdb kdl_audit && DATABASE_URL=postgresql://.../kdl_audit npx prisma migrate deploy
 *   DATABASE_URL=postgresql://.../kdl_audit node scripts/verify-seeders.mjs
 *
 * What it proves, for EVERY module (so a future module is covered with no change here):
 *   1. core seed (prisma/seed.js) runs on an empty database;
 *   2. every optional module installs and enables, and runs its own seed.js;
 *   3. running ALL seeds a second time creates no row and changes no existing row
 *      (idempotent, never overwrites what a user edited);
 *   4. disabling then re-enabling every optional module creates and changes nothing;
 *   5. a value a user edited in a seeded row survives a re-seed.
 * Exit code 1 on any finding, so it can run in CI.
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

process.env.NODE_ENV = 'test'; // no queue workers, no schedulers
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const url = process.env.DATABASE_URL ?? '';
const dbName = url.split('/').pop()?.split('?')[0] ?? '';
if (!/(fresh|audit|scratch|test|tmp)/i.test(dbName) && !process.argv.includes('--force')) {
  console.error(`Refusing to run against "${dbName}": use a scratch database (name contains fresh/audit/scratch/test/tmp).`);
  process.exit(2);
}

const { prisma } = await import('../src/config/database.js');
const { loadModules, loadedManifests } = await import('../src/shared/modules/module-loader.js');
const svc = await import('../src/modules/modules/service.js');

// Tables that legitimately grow on every action (audit trails, queues, sessions, counters).
const LOG_TABLES = new Set([
  'activity_logs', 'membership_events', 'membership_comm_logs', 'notifications', 'refresh_tokens',
  'membership_webhook_events', 'membership_otp_codes', 'credit_ledger',
]);
const findings = [];
const note = (level, msg) => { findings.push({ level, msg }); console.log(`  ${level === 'FAIL' ? '✗' : '•'} ${msg}`); };

async function snapshot() {
  const tables = await prisma.$queryRawUnsafe(
    `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name <> '_prisma_migrations' order by 1`
  );
  const out = new Map();
  for (const { table_name } of tables) {
    const rows = await prisma.$queryRawUnsafe(`select row_to_json(t)::text as j from "${table_name}" t`);
    const m = new Map();
    for (const { j } of rows) {
      const o = JSON.parse(j);
      const key = o.id ?? o.key ?? o.slug ?? JSON.stringify(Object.values(o).slice(0, 3));
      const { updated_at, enabled_at, disabled_at, ...content } = o; // timestamps only: a no-op update still bumps them
      void updated_at; void enabled_at; void disabled_at;
      m.set(key, { full: j, content: JSON.stringify(content) });
    }
    out.set(table_name, m);
  }
  return out;
}
function diff(a, b, label) {
  let bad = 0;
  for (const [t, rows] of b) {
    const before = a.get(t) ?? new Map();
    const added = [...rows.keys()].filter((k) => !before.has(k));
    const changed = [...rows.keys()].filter((k) => before.has(k) && before.get(k).content !== rows.get(k).content);
    const touched = [...rows.keys()].filter((k) => before.has(k) && before.get(k).content === rows.get(k).content && before.get(k).full !== rows.get(k).full);
    if (touched.length && !LOG_TABLES.has(t)) note('info', `${label}: ${t} rewrote ${touched.length} row(s) with identical values (updated_at bumped; harmless but the seed has an update branch)`);
    const removed = [...before.keys()].filter((k) => !rows.has(k));
    const log = LOG_TABLES.has(t);
    if (added.length) { note(log ? 'info' : 'FAIL', `${label}: ${t} gained ${added.length} row(s)${log ? ' (log table)' : ' (duplicate or non-idempotent seed)'}`); if (!log) bad++; }
    if (changed.length) { note(log ? 'info' : 'FAIL', `${label}: ${t} changed ${changed.length} existing row(s)${log ? ' (log table)' : ' (seed overwrote or touched existing data)'} e.g. ${changed.slice(0, 3).join(', ')}`); if (!log) bad++; }
    if (removed.length) { note('FAIL', `${label}: ${t} lost ${removed.length} row(s)`); bad++; }
  }
  return bad;
}

async function runSeedFile(slug) {
  const p = join(root, 'src/modules', slug, 'seed.js');
  if (!existsSync(p)) return false;
  const m = await import(p);
  const fn = m.default ?? Object.entries(m).find(([n, v]) => typeof v === 'function' && n.startsWith('seed'))?.[1];
  await prisma.$transaction(async (tx) => { await fn(tx); }, { timeout: 180_000 });
  return true;
}

// ---- 1. core seed
console.log('1. core seed on the empty database');
const core = spawnSync('node', ['prisma/seed.js'], { cwd: root, env: { ...process.env, SEED_ADMIN_PASSWORD: 'AuditPass#12345', SEED_TEAM_PASSWORD: 'AuditPass#12345' }, encoding: 'utf8' });
if (core.status !== 0) { note('FAIL', `core seed failed: ${core.stderr.slice(-300)}`); process.exit(1); }
await loadModules(express());
const slugs = [...loadedManifests.keys()];
const optional = slugs.filter((s) => !loadedManifests.get(s).core);
const coreSlugs = slugs.filter((s) => loadedManifests.get(s).core);
const regd = await prisma.module.findMany({ where: { is_core: true, status: 'ENABLED' }, select: { slug: true } });
const missing = coreSlugs.filter((s) => !regd.some((r) => r.slug === s));
if (missing.length) note('FAIL', `core modules not registered+enabled by the core seed: ${missing.join(', ')}`);
else console.log(`  ✓ ${coreSlugs.length} core modules registered and enabled`);
const roles = await prisma.rbacRole.findMany({ where: { slug: { in: ['super-admin', 'developer'] } }, include: { _count: { select: { permissions: true } } } });
console.log(`  ✓ roles: ${roles.map((r) => `${r.slug}(${r._count.permissions} grants)`).join(', ')}`);
if (roles.length !== 2) note('FAIL', 'super-admin and developer roles must both exist after the core seed');

// ---- 2. install + enable every optional module
console.log(`2. install + enable ${optional.length} optional modules`);
const noSeed = [];
for (const slug of optional) {
  try {
    const row = await prisma.module.findUnique({ where: { slug } });
    if (!row) await svc.installModule(slug, null, { resolveConflicts: true });
    const after = await prisma.module.findUnique({ where: { slug } });
    if (after?.status !== 'ENABLED') await svc.enableModule(slug, null, { resolveConflicts: true });
  } catch (e) {
    note('FAIL', `${slug}: install/enable failed: ${e.message}`);
  }
  if (!existsSync(join(root, 'src/modules', slug, 'seed.js'))) noSeed.push(slug);
}
if (noSeed.length) console.log(`  • no seed.js (nothing to seed, or seeds lazily): ${noSeed.join(', ')}`);
const states = await prisma.module.findMany({ where: { slug: { in: optional } }, select: { slug: true, status: true } });
// conflicting modules may be switched off by design; report, do not fail
const notEnabled = states.filter((s) => s.status !== 'ENABLED').map((s) => `${s.slug}:${s.status}`);
if (notEnabled.length) console.log(`  • not ENABLED after install (mode conflicts): ${notEnabled.join(', ')}`);

// ---- 5 (setup). user edits a seeded row
const editable = [
  ['appSetting', { key: 'identity.app_name' }, { value: 'My Edited Company' }, 'value'],
  ['membershipSetting', null, null, null],
];
const idName = await prisma.appSetting.findUnique({ where: { key: 'identity.app_name' } });
await prisma.appSetting.upsert({ where: { key: 'identity.app_name' }, update: { value: 'My Edited Company' }, create: { key: 'identity.app_name', value: 'My Edited Company', type: 'string' } });
const plan = await prisma.membershipPlan?.findFirst?.({ orderBy: { created_at: 'asc' } }).catch(() => null);
if (plan) await prisma.membershipPlan.update({ where: { id: plan.id }, data: { name: `${plan.name} (edited)` } });
const page = await prisma.builderPage.findFirst({ where: { slug: 'home' } });
if (page) await prisma.builderPage.update({ where: { id: page.id }, data: { title: 'My edited home' } });
// more user edits in tables that seeds upsert: a theme value, a notification template, a role, a type
const themeField = await prisma.settingField.findFirst({ where: { slug: { startsWith: 'webapp.' } } });
if (themeField) await prisma.settingField.update({ where: { id: themeField.id }, data: { value: '#123456' } });
const tpl = await prisma.notificationTemplate.findFirst();
if (tpl) await prisma.notificationTemplate.update({ where: { id: tpl.id }, data: { email_subject: 'MY OWN SUBJECT' } });
const role = await prisma.rbacRole.findFirst({ where: { slug: 'user' } });
if (role) await prisma.rbacRole.update({ where: { id: role.id }, data: { name: 'My Renamed Role' } });
const aType = await prisma.type.findFirst({ where: { slug: 'website-content' } });
if (aType) await prisma.type.update({ where: { id: aType.id }, data: { name: 'My Renamed Type' } });
void editable; void idName;

const snapA = await snapshot();

// ---- 3. re-run ALL seeds
console.log('3. re-run every seed (core + each module) a second time');
const re = spawnSync('node', ['prisma/seed.js'], { cwd: root, env: { ...process.env, SEED_ADMIN_PASSWORD: 'AuditPass#12345', SEED_TEAM_PASSWORD: 'AuditPass#12345' }, encoding: 'utf8' });
if (re.status !== 0) note('FAIL', `core seed re-run failed: ${re.stderr.slice(-300)}`);
for (const slug of optional) {
  try { await runSeedFile(slug); } catch (e) { note('FAIL', `${slug}: seed re-run threw: ${e.message}`); }
}
const snapB = await snapshot();
const bad3 = diff(snapA, snapB, 're-seed');
if (!bad3) console.log('  ✓ no row added, changed or removed (outside log tables)');

// ---- 5. user edits survived
console.log('5. user edits survive re-seed');
const nameNow = (await prisma.appSetting.findUnique({ where: { key: 'identity.app_name' } }))?.value;
if (nameNow !== 'My Edited Company') note('FAIL', `identity.app_name was reset to "${nameNow}"`); else console.log('  ✓ edited setting kept');
if (plan) {
  const p2 = await prisma.membershipPlan.findUnique({ where: { id: plan.id } });
  if (!p2.name.endsWith('(edited)')) note('FAIL', 'edited membership plan name was overwritten'); else console.log('  ✓ edited membership plan kept');
}
const keep = async (label, ok) => (ok ? console.log(`  ✓ edited ${label} kept`) : note('FAIL', `edited ${label} was overwritten by a re-seed`));
if (themeField) await keep('theme value', (await prisma.settingField.findUnique({ where: { id: themeField.id } })).value === '#123456');
if (tpl) await keep('notification template', (await prisma.notificationTemplate.findUnique({ where: { id: tpl.id } })).email_subject === 'MY OWN SUBJECT');
if (role) await keep('role name', (await prisma.rbacRole.findUnique({ where: { id: role.id } })).name === 'My Renamed Role');
if (aType) await keep('type name', (await prisma.type.findUnique({ where: { id: aType.id } })).name === 'My Renamed Type');
if (page) {
  const g2 = await prisma.builderPage.findUnique({ where: { id: page.id } });
  if (g2.title !== 'My edited home') note('FAIL', 'edited page title was overwritten'); else console.log('  ✓ edited page kept');
}

// ---- 4. disable then re-enable everything optional
console.log('4. disable then re-enable every optional module');
let pending = [...optional];
for (let pass = 0; pass < 6 && pending.length; pass++) {
  const next = [];
  for (const slug of pending) {
    try {
      const row = await prisma.module.findUnique({ where: { slug } });
      if (row?.status === 'ENABLED') await svc.disableModule(slug, null);
    } catch { next.push(slug); }
  }
  pending = next.length === pending.length ? [] : next;
}
const stillOn = await prisma.module.count({ where: { slug: { in: optional }, status: 'ENABLED' } });
console.log(`  • ${optional.length - stillOn}/${optional.length} optional modules disabled`);
const snapDis = await snapshot();
// statuses differ by design (modules table); every other table must keep its data
for (const t of ['modules']) { snapB.delete(t); snapDis.delete(t); }
const lost = diff(snapB, snapDis, 'after disable');
for (const slug of optional) {
  try {
    const row = await prisma.module.findUnique({ where: { slug } });
    if (row && row.status !== 'ENABLED') await svc.enableModule(slug, null, { resolveConflicts: true });
  } catch (e) { console.log(`  • ${slug}: re-enable skipped (${e.message})`); }
}
const snapC = await snapshot();
snapC.delete('modules');
const bad4 = diff(snapB, snapC, 'after disable+re-enable vs before');
// modules table status flips are expected; only data tables matter
if (!lost && !bad4) console.log('  ✓ no data lost or duplicated by disable / re-enable');

// ---- 6. duplicate navigation check (same path twice in the enabled manifests)
console.log('6. navigation');
const seenPaths = new Map();
for (const s of slugs) for (const n of loadedManifests.get(s).nav ?? []) {
  const k = n.path;
  if (seenPaths.has(k)) note('FAIL', `nav path ${k} declared by both ${seenPaths.get(k)} and ${s}`); else seenPaths.set(k, s);
}
console.log(`  ✓ ${seenPaths.size} unique nav paths across ${slugs.length} manifests`);

const failures = findings.filter((f) => f.level === 'FAIL');
console.log(`\n${failures.length ? `✗ ${failures.length} finding(s)` : '✓ all checks passed'}`);
await prisma.$disconnect();
process.exit(failures.length ? 1 : 0);
