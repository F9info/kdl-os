/**
 * S5: auth hardening. One test per fix, each aimed at the exact scenario that was broken.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';

const store = new Map();
vi.mock('../../src/config/redis.js', () => ({
  redis: {
    incr: vi.fn(async (k) => { store.set(k, (store.get(k) || 0) + 1); return store.get(k); }),
    expire: vi.fn(async () => 1),
    pexpire: vi.fn(async () => 1),
    pttl: vi.fn(async () => 1000),
    decr: vi.fn(),
    get: vi.fn(async (k) => (store.has(k) ? String(store.get(k)) : null)),
    set: vi.fn(async (k, v) => { store.set(k, v); }),
    del: vi.fn(async (...ks) => ks.forEach((k) => store.delete(k))),
  },
}));
vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    passwordResetToken: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    refreshToken: { updateMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock('../../src/shared/queues/email.queue.js', () => ({ emailQueue: { add: vi.fn() } }));

import { prisma } from '../../src/config/database.js';
import { emailQueue } from '../../src/shared/queues/email.queue.js';
import * as svc from '../../src/modules/auth/service.js';
import { registerSchema, resetPasswordSchema, changePasswordSchema } from '../../src/modules/auth/schema.js';
import { RedisRateLimitStore } from '../../src/shared/utils/redis-rate-limit-store.js';

beforeEach(() => { store.clear(); vi.clearAllMocks(); });

describe('lockout counter is atomic', () => {
  it('50 parallel wrong guesses are all counted (get-then-set lost most of them)', async () => {
    await Promise.all(Array.from({ length: 50 }, () => svc.recordFailedLoginAttempt('v@x.com')));
    expect(store.get('auth:lockout:v@x.com')).toBe(50);
  });

  it('locks at 5 failures and clears on success', async () => {
    for (let i = 0; i < 4; i++) expect(await svc.recordFailedLoginAttempt('v@x.com')).toBeNull();
    const until = await svc.recordFailedLoginAttempt('v@x.com');
    expect(until).toBeGreaterThan(Date.now());
    expect(await svc.checkAccountLockout('v@x.com')).toBe(until);
    await svc.clearLoginLockout('v@x.com');
    expect(await svc.checkAccountLockout('v@x.com')).toBeNull();
  });
});

describe('reset email', () => {
  it('escapes the user name (it is user-chosen and lands in HTML)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: 'a@x.com', name: '<img src=x onerror=alert(1)>', is_active: true, status: 'ACTIVE', deleted_at: null });
    prisma.$transaction.mockResolvedValue([]);
    await svc.createPasswordResetToken('a@x.com');
    const html = emailQueue.add.mock.calls[0][1].html;
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
  });
});

describe('reset token cannot be used twice in parallel', () => {
  it('when another request already claimed the token, the password is not changed', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({ id: 't1', user: { id: 'u1', is_active: true, status: 'ACTIVE', deleted_at: null } });
    prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 0 }); // lost the race
    const out = await svc.resetPassword('tok', 'a-long-enough-password');
    expect(out).toBeNull();
    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('password rules', () => {
  const reg = (password) => registerSchema.safeParse({ body: { name: 'Ann', email: 'a@x.com', password } }).success;
  it('needs 12 characters', () => {
    expect(reg('elevenchars')).toBe(false);
    expect(reg('twelve-chars')).toBe(true);
  });
  it('rejects more than 72 bytes (bcrypt would silently cut it): multi-byte counts as bytes', () => {
    expect(reg('a'.repeat(72))).toBe(true);
    expect(reg('a'.repeat(73))).toBe(false);
    expect(reg('é'.repeat(37))).toBe(false); // 37 chars but 74 bytes
  });
  it('applies to reset and change too', () => {
    expect(resetPasswordSchema.safeParse({ body: { token: 't', password: 'short' } }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ body: { currentPassword: 'x', newPassword: 'short' } }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ body: { currentPassword: 'x', newPassword: 'a-long-enough-one' } }).success).toBe(true);
  });
});

describe('Redis-backed limiter store', () => {
  it('counts in Redis, so a second instance or a restart shares the count', async () => {
    const a = new RedisRateLimitStore('t');
    const b = new RedisRateLimitStore('t'); // "another instance"
    a.init({ windowMs: 1000 }); b.init({ windowMs: 1000 });
    await a.increment('1.2.3.4');
    expect((await b.increment('1.2.3.4')).totalHits).toBe(2);
  });
});

describe('routes', () => {
  it('the sign-in limiter is keyed on the IP alone, so cycling emails does not reset it; refresh is limited', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../../src/modules/auth/routes.js', import.meta.url), 'utf8');
    expect(src).toMatch(/keyGenerator: \(req\) => req\.ip,\s*\n\s*store: new RedisRateLimitStore\('auth'\)/);
    expect(src).toMatch(/router\.post\('\/refresh', refreshLimiter/);
  });
});
