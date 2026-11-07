import { describe, it, expect, vi, beforeEach } from 'vitest';
import { planTeamUsers, seedTeamUsers } from '../../prisma/seed-team-users.js';

describe('planTeamUsers', () => {
  it('plans a Developer and an Admin with random, different passwords', () => {
    const plan = planTeamUsers({ NODE_ENV: 'development' });
    expect(plan.map((u) => [u.role, u.email])).toEqual([
      ['developer', 'developer@kdl.com'],
      ['admin', 'siteadmin@kdl.com'],
    ]);
    expect(plan.every((u) => u.generated && u.password.length >= 20)).toBe(true);
    expect(plan[0].password).not.toBe(plan[1].password);
  });

  it('never plans demo accounts in production', () => {
    expect(planTeamUsers({ NODE_ENV: 'production' })).toEqual([]);
    expect(planTeamUsers({ NODE_ENV: 'production', SEED_TEAM_PASSWORD: 'a-strong-shared-password' })).toEqual([]);
  });

  it('can be switched off', () => {
    expect(planTeamUsers({ SEED_TEAM_USERS: 'false' })).toEqual([]);
  });

  it('takes other addresses, lower-cased', () => {
    const plan = planTeamUsers({ SEED_DEVELOPER_EMAIL: ' Dev@Example.COM ', SEED_SITE_ADMIN_EMAIL: 'ops@example.com' });
    expect(plan.map((u) => u.email)).toEqual(['dev@example.com', 'ops@example.com']);
  });

  it('uses one shared password when given, and marks it as not generated', () => {
    const plan = planTeamUsers({ SEED_TEAM_PASSWORD: 'a-strong-shared-password' });
    expect(plan.every((u) => u.password === 'a-strong-shared-password' && !u.generated)).toBe(true);
  });

  it('rejects a shared password shorter than 12 characters', () => {
    expect(() => planTeamUsers({ SEED_TEAM_PASSWORD: 'short' })).toThrow(/at least 12 characters/);
  });

  it('never uses the old Admin@123 default', () => {
    const plan = planTeamUsers({ NODE_ENV: 'development' });
    expect(plan.some((u) => u.password === 'Admin@123')).toBe(false);
  });
});

describe('seedTeamUsers', () => {
  const prisma = {
    rbacRole: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), create: vi.fn() },
    userRole: { upsert: vi.fn() },
  };
  const log = vi.fn();
  const run = (env = { NODE_ENV: 'development' }) => seedTeamUsers(prisma, env, log);

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.rbacRole.findUnique.mockImplementation(async ({ where }) => ({ id: `role-${where.slug}` }));
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: `user-${data.email}`, ...data }));
  });

  it('creates both users, hashed and forced to change the password, and gives each its role', async () => {
    expect(await run()).toEqual(['developer@kdl.com', 'siteadmin@kdl.com']);
    const first = prisma.user.create.mock.calls[0][0].data;
    expect(first.must_change_password).toBe(true);
    expect(first.is_active).toBe(true);
    expect(first.password_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { user_id: 'user-developer@kdl.com', role_id: 'role-developer' } })
    );
    expect(prisma.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: { user_id: 'user-siteadmin@kdl.com', role_id: 'role-admin' } })
    );
  });

  it('prints each generated password once and never the hash', async () => {
    await run();
    const lines = log.mock.calls.map((c) => c[0]).join('\n');
    expect(lines).toMatch(/Generated one-time password for the developer user/);
    expect(lines).toMatch(/Generated one-time password for the admin user/);
    expect(lines).not.toMatch(/\$2[aby]\$/);
  });

  it('does not print a shared password', async () => {
    await run({ NODE_ENV: 'development', SEED_TEAM_PASSWORD: 'a-strong-shared-password' });
    expect(log.mock.calls.map((c) => c[0]).join('\n')).not.toContain('a-strong-shared-password');
  });

  it('leaves an existing account untouched', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'already' });
    expect(await run()).toEqual([]);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(prisma.userRole.upsert).not.toHaveBeenCalled();
  });

  it('skips an account whose role is missing instead of creating a user with no role', async () => {
    prisma.rbacRole.findUnique.mockImplementation(async ({ where }) => (where.slug === 'developer' ? null : { id: 'role-admin' }));
    expect(await run()).toEqual(['siteadmin@kdl.com']);
    expect(log.mock.calls.map((c) => c[0]).join('\n')).toMatch(/"developer" role does not exist/);
  });

  it('creates nothing in production', async () => {
    expect(await run({ NODE_ENV: 'production' })).toEqual([]);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });
});
