import { prisma } from '../../config/database.js';

// Server-side install record, in app_settings (no new table). Never trust the browser for this.
export const K = {
  status: 'install.status', // pending | running | completed
  appType: 'install.app_type',
  step: 'install.step', // furthest step saved: 0..2
  startedAt: 'install.started_at',
  completedAt: 'install.completed_at',
};
export const STALE_RUN_MS = 10 * 60 * 1000;

let installedCache = false; // only "true" is cached: it can never go back

export const resetInstallCache = () => {
  installedCache = false;
};

export async function getSetting(key, db = prisma) {
  const row = await db.appSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export const setSetting = (key, value, db = prisma, description = 'First-run installation') =>
  db.appSetting.upsert({
    where: { key },
    update: { value: String(value) },
    create: { key, value: String(value), type: 'string', description, is_public: false },
  });

export async function isInstalled(db = prisma) {
  if (installedCache) return true;
  const done = (await getSetting(K.status, db)) === 'completed';
  if (done) installedCache = true;
  return done;
}

/**
 * Databases that existed before the wizard must not be sent back to it. A record is written once:
 * `KDL_SKIP_INSTALL_WIZARD=1` (CI, scripted installs), or proof the install is already in use
 * (somebody has logged in, or identity was filled in). A fresh seeded database has neither.
 */
export async function backfillInstalled(db = prisma, env = process.env) {
  if (await getSetting(K.status, db)) return null;
  const inUse =
    env.KDL_SKIP_INSTALL_WIZARD === '1' ||
    (await db.user.count({ where: { last_login_at: { not: null } } })) > 0 ||
    (await db.appSetting.count({ where: { key: 'identity.company_name', NOT: { value: '' } } })) > 0;
  if (!inUse) return false;
  await setSetting(K.status, 'completed', db);
  await setSetting(K.completedAt, new Date().toISOString(), db);
  installedCache = true;
  return true;
}

