import { describe, it, expect, vi, beforeEach } from 'vitest';

const settings = new Map();
const db = {
  appSetting: {
    findUnique: vi.fn(async ({ where }) => (settings.has(where.key) ? { key: where.key, value: settings.get(where.key) } : null)),
    upsert: vi.fn(async ({ where, update, create }) => {
      settings.set(where.key, settings.has(where.key) ? update.value : create.value);
    }),
  },
};
vi.mock('../../config/database.js', () => ({ prisma: db }));
vi.mock('../utils/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { logger } = await import('../utils/logger.js');
const status = await import('./status.js');
const t = await import('./setup-token.js');

beforeEach(() => {
  settings.clear();
  status.resetInstallCache();
  vi.clearAllMocks();
});

describe('setup token', () => {
  it('generates one at start while the install is open, logs it once and stores only its hash', async () => {
    const r = await t.ensureSetupToken(db, {});
    expect(r.source).toBe('generated');
    expect(r.token.length).toBeGreaterThanOrEqual(24);
    const stored = settings.get(t.HASH_KEY);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
    expect(stored).not.toContain(r.token);
    expect(logger.warn.mock.calls[0][0]).toContain(r.token);
    // second start: same token stays valid, nothing new is printed
    expect((await t.ensureSetupToken(db, {})).source).toBe('stored');
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(await t.verifySetupToken(r.token, db, {})).toBe(true);
  });

  it('accepts only the right token', async () => {
    const { token } = await t.ensureSetupToken(db, {});
    expect(await t.verifySetupToken(token + 'x', db, {})).toBe(false);
    expect(await t.verifySetupToken('', db, {})).toBe(false);
    expect(await t.verifySetupToken(undefined, db, {})).toBe(false);
    expect(await t.verifySetupToken('a'.repeat(500), db, {})).toBe(false);
  });

  it('refuses everything when no token exists at all (never open by default)', async () => {
    expect(await t.verifySetupToken('anything-long-enough', db, {})).toBe(false);
  });

  it('KDL_SETUP_TOKEN wins, stores nothing, and a short one is ignored with a warning', async () => {
    const env = { KDL_SETUP_TOKEN: 'ci-setup-token-123456' };
    expect((await t.ensureSetupToken(db, env)).source).toBe('env');
    expect(settings.has(t.HASH_KEY)).toBe(false);
    expect(await t.verifySetupToken('ci-setup-token-123456', db, env)).toBe(true);
    expect(await t.verifySetupToken('ci-setup-token-12345X', db, env)).toBe(false);

    const short = { KDL_SETUP_TOKEN: 'short' };
    expect((await t.ensureSetupToken(db, short)).source).toBe('generated');
    expect(logger.warn.mock.calls.some((c) => /shorter than/.test(c[0]))).toBe(true);
  });

  it('does nothing once the install is complete, and regenerate invalidates the old token', async () => {
    const first = await t.ensureSetupToken(db, {});
    const next = await t.regenerateSetupToken(db);
    expect(await t.verifySetupToken(first.token, db, {})).toBe(false);
    expect(await t.verifySetupToken(next, db, {})).toBe(true);
    settings.set('install.status', 'completed');
    status.resetInstallCache();
    settings.delete(t.HASH_KEY);
    expect((await t.ensureSetupToken(db, {})).source).toBe('none');
    expect(settings.has(t.HASH_KEY)).toBe(false);
  });

  it('middleware answers 401 SETUP_TOKEN_REQUIRED without the header, passes with it', async () => {
    const { token } = await t.ensureSetupToken(db, {});
    const res = { status: vi.fn(() => res), json: vi.fn() };
    const next = vi.fn();
    await t.requireSetupToken({ get: () => undefined }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].code).toBe('SETUP_TOKEN_REQUIRED');
    expect(next).not.toHaveBeenCalled();
    await t.requireSetupToken({ get: (h) => (h === t.SETUP_TOKEN_HEADER ? token : undefined) }, res, next);
    expect(next).toHaveBeenCalledOnce();
  });
});
