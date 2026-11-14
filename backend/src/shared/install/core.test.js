import { describe, it, expect, vi, beforeEach } from 'vitest';

const settings = new Map();
let users = [];
let userRoles = [];
const roles = [{ id: 'r-super', slug: 'super-admin' }];
let seq = 0;

const db = {
  appSetting: {
    findUnique: vi.fn(async ({ where }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
    upsert: vi.fn(async ({ where, update, create }) => {
      settings.set(where.key, settings.has(where.key) ? (update.value ?? settings.get(where.key)) : create.value);
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      const cur = settings.get(where.key);
      // 'running' rows only match when stale; the tests never make one stale, so it is a plain miss
      if (where.OR.some((c) => c.value === cur && c.updated_at === undefined)) {
        settings.set(where.key, data.value);
        return { count: 1 };
      }
      return { count: 0 };
    }),
  },
  user: {
    findUnique: vi.fn(async ({ where }) => users.find((u) => u.email === where.email) ?? null),
    update: vi.fn(async ({ where, data }) => Object.assign(users.find((u) => u.id === where.id), data)),
    create: vi.fn(async ({ data }) => {
      const u = { id: `u${++seq}`, last_login_at: null, deleted_at: null, ...data };
      users.push(u);
      return u;
    }),
  },
  userRole: {
    findFirst: vi.fn(async () => {
      const link = userRoles.find((l) => l.role_id === 'r-super' && users.find((u) => u.id === l.user_id && u.must_change_password && !u.last_login_at));
      return link ? { user_id: link.user_id } : null;
    }),
    upsert: vi.fn(async ({ where }) => {
      const { user_id, role_id } = where.user_id_role_id;
      if (!userRoles.some((l) => l.user_id === user_id && l.role_id === role_id)) userRoles.push({ user_id, role_id });
    }),
  },
  rbacRole: { findUnique: vi.fn(async ({ where }) => roles.find((r) => r.slug === where.slug) ?? null) },
};
vi.mock('../../config/database.js', () => ({ prisma: db }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const status = await import('./status.js');
const core = await import('./core.js');

const pw = 'correct horse battery';
const admin = { name: 'Asha Rao', email: 'asha@acme.test', password: pw };

beforeEach(() => {
  settings.clear();
  users = [];
  userRoles = [];
  seq = 0;
  status.resetInstallCache();
  vi.clearAllMocks();
});

// a fake seed that behaves like runCoreSeed: admin first, roles, then the afterRoles hook, with progress callbacks
const fakeSeed = (names = ['modules', 'roles']) =>
  vi.fn(async (_db, { createAdmin, afterRoles, onStep }) => {
    await createAdmin();
    for (const name of names) {
      await onStep({ name, status: 'running' });
      await onStep({ name, status: 'done' });
      if (name === 'roles') await afterRoles();
    }
  });

describe('saveAdmin', () => {
  it('stores only a bcrypt hash, never the password, and records the step', async () => {
    await core.saveAdmin(admin, db);
    const raw = settings.get(core.ADMIN_KEY);
    expect(raw).not.toContain(pw);
    expect(JSON.parse(raw).password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await core.adminDraft(db)).toEqual({ name: 'Asha Rao', email: 'asha@acme.test' });
    expect(JSON.parse(settings.get('install.steps')).admin).toMatchObject({ status: 'done', email: 'asha@acme.test' });
  });

  it('refuses an email that belongs to an account in use, accepts an untouched seeded one', async () => {
    users.push({ id: 'u0', email: 'asha@acme.test', must_change_password: false, last_login_at: new Date() });
    await expect(core.saveAdmin(admin, db)).rejects.toMatchObject({ status: 409 });
    users[0] = { id: 'u0', email: 'asha@acme.test', must_change_password: true, last_login_at: null };
    await expect(core.saveAdmin(admin, db)).resolves.toBeTruthy();
  });

  it('is refused once the install is complete or the core step is done', async () => {
    settings.set(core.CORE_KEY, 'done');
    await expect(core.saveAdmin(admin, db)).rejects.toMatchObject({ status: 409 });
    settings.delete(core.CORE_KEY);
    settings.set('install.status', 'completed');
    status.resetInstallCache();
    await expect(core.saveAdmin(admin, db)).rejects.toMatchObject({ status: 409 });
  });
});

describe('createOrClaimAdmin', () => {
  const draft = { name: 'Asha Rao', email: 'Asha@Acme.test', password_hash: '$2b$12$hash' };

  it('creates a new account when none exists', async () => {
    const id = await core.createOrClaimAdmin(draft, db);
    expect(users).toEqual([expect.objectContaining({ id, email: 'asha@acme.test', must_change_password: false, is_active: true })]);
  });

  it('takes over the untouched seeded Super Admin instead of making a second admin', async () => {
    users.push({ id: 'seeded', email: 'admin@kdl.com', name: 'Super Admin', must_change_password: true, last_login_at: null, deleted_at: null });
    userRoles.push({ user_id: 'seeded', role_id: 'r-super' });
    const id = await core.createOrClaimAdmin(draft, db);
    expect(id).toBe('seeded');
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: 'asha@acme.test', name: 'Asha Rao', must_change_password: false });
  });

  it('never touches a Super Admin that has already signed in', async () => {
    users.push({ id: 'live', email: 'admin@kdl.com', must_change_password: false, last_login_at: new Date(), deleted_at: null });
    userRoles.push({ user_id: 'live', role_id: 'r-super' });
    await core.createOrClaimAdmin(draft, db);
    expect(users.find((u) => u.id === 'live').email).toBe('admin@kdl.com');
    expect(users).toHaveLength(2);
  });

  it('refuses an email that is in use', async () => {
    users.push({ id: 'x', email: 'asha@acme.test', must_change_password: false, last_login_at: new Date() });
    await expect(core.createOrClaimAdmin(draft, db)).rejects.toMatchObject({ status: 409 });
  });
});

describe('runCore', () => {
  it('needs the admin step first', async () => {
    await expect(core.runCore({ db, seed: fakeSeed() })).rejects.toMatchObject({ status: 422 });
  });

  it('runs the seeders, creates the admin with the super-admin role, drops the hash and logs every step', async () => {
    await core.saveAdmin(admin, db);
    const seed = fakeSeed();
    const r = await core.runCore({ db, seed });
    expect(r).toEqual({ status: 'done', seeded: ['modules', 'roles'] });
    expect(settings.get(core.CORE_KEY)).toBe('done');
    expect(users).toHaveLength(1);
    expect(userRoles).toEqual([{ user_id: users[0].id, role_id: 'r-super' }]);
    expect(settings.get(core.ADMIN_KEY)).not.toContain('password_hash');
    const log = JSON.parse(settings.get('install.log')).map((l) => l.message);
    expect(log).toEqual(expect.arrayContaining(['core installation started', 'modules: done', 'roles: done']));
    expect(JSON.parse(settings.get('install.steps')).core.status).toBe('done');
  });

  it('done is final: asking again does not run the seeders a second time', async () => {
    await core.saveAdmin(admin, db);
    const seed = fakeSeed();
    await core.runCore({ db, seed });
    // the draft no longer has a hash, so re-running must short-circuit on "done" before needing one
    settings.set(core.ADMIN_KEY, JSON.stringify({ name: 'Asha Rao', email: 'asha@acme.test', password_hash: 'x' }));
    expect(await core.runCore({ db, seed })).toEqual({ status: 'done', already: true });
    expect(seed).toHaveBeenCalledOnce();
  });

  it('a failure is recorded, leaves the step retryable, and the retry succeeds', async () => {
    await core.saveAdmin(admin, db);
    const boom = vi.fn(async () => {
      throw new Error('seed exploded');
    });
    await expect(core.runCore({ db, seed: boom })).rejects.toThrow(/Core installation stopped: seed exploded/);
    expect(settings.get(core.CORE_KEY)).toBe('failed');
    expect(JSON.parse(settings.get('install.steps')).core).toMatchObject({ status: 'failed', error: 'seed exploded' });
    expect(JSON.parse(settings.get('install.log')).at(-1).level).toBe('error');
    // retry with a working seed
    expect((await core.runCore({ db, seed: fakeSeed() })).status).toBe('done');
    expect(settings.get(core.CORE_KEY)).toBe('done');
  });

  it('refuses a second run while one is running', async () => {
    await core.saveAdmin(admin, db);
    settings.set(core.CORE_KEY, 'running');
    await expect(core.runCore({ db, seed: fakeSeed() })).rejects.toMatchObject({ status: 409, message: /already running/ });
  });

  it('is refused once the install is complete', async () => {
    await core.saveAdmin(admin, db);
    settings.set('install.status', 'completed');
    status.resetInstallCache();
    await expect(core.runCore({ db, seed: fakeSeed() })).rejects.toMatchObject({ status: 409 });
  });
});
