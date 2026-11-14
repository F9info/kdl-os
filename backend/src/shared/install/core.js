import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { STALE_RUN_MS, getSetting, setSetting, isInstalled } from './status.js';
import { markStep, logInstall } from './progress.js';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export const ADMIN_KEY = 'install.admin'; // { name, email, password_hash } until the core step has used it
export const CORE_KEY = 'install.core'; // none | running | done | failed

const assertOpen = async (db) => {
  if (await isInstalled(db)) throw fail('Installation is already complete', 409);
};
const readAdmin = async (db) => {
  try {
    return JSON.parse((await getSetting(ADMIN_KEY, db)) ?? 'null');
  } catch {
    return null;
  }
};

// A seeded account nobody has used yet: provisional password, never signed in. The wizard may take it over;
// an account that is in use is never touched.
const pristine = (u) => !!u && u.must_change_password && !u.last_login_at;

/** Installer step 3: the Super Admin account. Only a bcrypt hash is stored, and only until the core step uses it. */
export async function saveAdmin({ name, email, password }, db = prisma) {
  await assertOpen(db);
  if ((await getSetting(CORE_KEY, db)) === 'done') throw fail('The admin account is already created', 409);
  const clash = await db.user.findUnique({ where: { email } });
  if (clash && !pristine(clash)) throw fail('That email already belongs to an account that is in use. Use another.', 409);
  const password_hash = await bcrypt.hash(password, 12);
  await setSetting(ADMIN_KEY, JSON.stringify({ name, email, password_hash }), db, 'Installer admin draft (hash only)');
  await markStep('admin', { status: 'done', email }, db);
  await logInstall('admin', 'info', `admin account saved for ${email}`, db);
  return { name, email };
}

export async function adminDraft(db = prisma) {
  const a = await readAdmin(db);
  return a ? { name: a.name, email: a.email } : null;
}

/**
 * Create the Super Admin from the wizard's draft, or take over an untouched seeded one (so a database that was
 * already seeded does not end up with two admins). Returns the user id.
 */
export async function createOrClaimAdmin(draft, db = prisma) {
  const email = draft.email.toLowerCase();
  const data = { name: draft.name, password_hash: draft.password_hash, must_change_password: false, is_active: true };
  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) {
    if (!pristine(byEmail)) throw fail('That email already belongs to an account that is in use.', 409);
    await db.user.update({ where: { id: byEmail.id }, data });
    return byEmail.id;
  }
  const seeded = await db.userRole.findFirst({
    where: { role: { slug: 'super-admin' }, user: { must_change_password: true, last_login_at: null, deleted_at: null } },
    select: { user_id: true },
  });
  if (seeded) {
    await db.user.update({ where: { id: seeded.user_id }, data: { ...data, email } });
    return seeded.user_id;
  }
  return (await db.user.create({ data: { ...data, email } })).id;
}

export async function assignSuperAdmin(email, db = prisma) {
  const [user, role] = await Promise.all([
    db.user.findUnique({ where: { email: email.toLowerCase() }, select: { id: true } }),
    db.rbacRole.findUnique({ where: { slug: 'super-admin' }, select: { id: true } }),
  ]);
  if (!user || !role) throw fail('The Super Admin role or user is missing after the role seed', 500);
  await db.userRole.upsert({
    where: { user_id_role_id: { user_id: user.id, role_id: role.id } },
    update: {},
    create: { user_id: user.id, role_id: role.id },
  });
}

export const coreStatus = async (db = prisma) => (await getSetting(CORE_KEY, db)) ?? 'none';

/**
 * Installer step 4: the core seeds (modules, projects, roles and permissions, default users, brand kit, theme,
 * credits) and the Super Admin, through the same ordered list as `npm run db:seed`.
 *  - One run at a time (compare-and-set); a crashed run is retried after STALE_RUN_MS.
 *  - Done is final: asking again does not run the seeders a second time.
 *  - A failure is recorded and leaves the step retryable; every seeder is idempotent, so a retry never duplicates.
 */
export async function runCore({ db = prisma, seed } = {}) {
  await assertOpen(db);
  const draft = await readAdmin(db);
  if (!draft?.password_hash) throw fail('Finish the admin account step first', 422);
  if ((await coreStatus(db)) === 'done') return { status: 'done', already: true };

  await db.appSetting.upsert({
    where: { key: CORE_KEY },
    update: {},
    create: { key: CORE_KEY, value: 'none', type: 'string', description: 'Installer core step', is_public: false },
  });
  const stale = new Date(Date.now() - STALE_RUN_MS);
  const lock = await db.appSetting.updateMany({
    where: { key: CORE_KEY, OR: [{ value: 'none' }, { value: 'failed' }, { value: 'running', updated_at: { lt: stale } }] },
    data: { value: 'running' },
  });
  if (lock.count === 0) throw fail('Core installation is already running', 409);

  await markStep('core', { status: 'running', error: null }, db);
  await logInstall('core', 'info', 'core installation started', db);
  try {
    const runCoreSeed = seed ?? (await import('../../../prisma/core-seed.js')).runCoreSeed;
    const seeded = [];
    await runCoreSeed(db, {
      createAdmin: async () => {
        await createOrClaimAdmin(draft, db);
        await logInstall('core', 'info', `super admin ready: ${draft.email}`, db);
      },
      afterRoles: (tx) => assignSuperAdmin(draft.email, tx ?? db), // inside the roles transaction: its rows are not visible outside yet
      onStep: async ({ name, status }) => {
        if (status === 'done') seeded.push(name);
        await logInstall('core', 'info', `${name}: ${status}`, db);
      },
    });
    // The password hash has done its job: keep only who the admin is.
    await setSetting(ADMIN_KEY, JSON.stringify({ name: draft.name, email: draft.email }), db, 'Installer admin draft');
    await setSetting(CORE_KEY, 'done', db);
    await markStep('core', { status: 'done', seeded }, db);
    await logInstall('core', 'info', `core installation finished (${seeded.length} seeders)`, db);
    return { status: 'done', seeded };
  } catch (err) {
    await setSetting(CORE_KEY, 'failed', db).catch(() => {});
    await markStep('core', { status: 'failed', error: String(err.message).slice(0, 300) }, db).catch(() => {});
    await logInstall('core', 'error', `core installation failed: ${err.message}`, db).catch(() => {});
    throw fail(`Core installation stopped: ${err.message}. Nothing was marked complete; run it again to retry.`, err.status >= 400 && err.status < 500 ? err.status : 500);
  }
}
