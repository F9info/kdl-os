import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    userRole: { findMany: vi.fn() },
    userPermission: { findMany: vi.fn() },
  },
}));

const cache = new Map();
vi.mock('../src/config/redis.js', () => ({
  redis: {
    get: vi.fn((key) => Promise.resolve(cache.get(key) ?? null)),
    setex: vi.fn((key, ttl, value) => {
      cache.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn((...keys) => {
      for (const k of keys) cache.delete(k);
      return Promise.resolve(keys.length);
    }),
    scan: vi.fn((_cursor, _command, _pattern, _count, _countVal) => {
      return Promise.resolve(['0', Array.from(cache.keys())]);
    }),
  },
}));

import { prisma } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';
import {
  resolvePermissions,
  hasPermission,
  invalidatePermissionCache,
} from '../src/modules/user-management/shared/permission-resolver.js';

function mockUser(status = 'ACTIVE', deletedAt = null) {
  prisma.user.findUnique.mockResolvedValue({ status, deleted_at: deletedAt });
}

function rolePerm(moduleName, action) {
  return {
    permission: {
      module: { name: moduleName },
      action,
    },
  };
}

function override(moduleName, action, mode) {
  return {
    mode,
    permission: {
      module: { name: moduleName },
      action,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  cache.clear();
  mockUser();
  prisma.userRole.findMany.mockResolvedValue([]);
  prisma.userPermission.findMany.mockResolvedValue([]);
});

describe('permission-resolver', () => {
  it('1. super-admin bypass returns all access with no permission rows', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'super-admin', permissions: [] } },
    ]);
    const result = await resolvePermissions('u1');
    expect(result.bypass).toBe(true);
    expect(result.permissions).toEqual([]);
    expect(redis.setex).toHaveBeenCalled();
  });

  it('2. role permission is granted', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'admin', permissions: [rolePerm('users', 'view')] } },
    ]);
    const result = await resolvePermissions('u1');
    expect(result.bypass).toBe(false);
    expect(result.permissions).toContain('users:view');
    await expect(hasPermission('u1', 'users', 'view')).resolves.toBe(true);
  });

  it('3. role permission is denied when not assigned', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'user', permissions: [] } },
    ]);
    await expect(hasPermission('u1', 'users', 'delete')).resolves.toBe(false);
  });

  it('4. no role and no override results in no permissions', async () => {
    const result = await resolvePermissions('u1');
    expect(result.permissions).toHaveLength(0);
  });

  it('5. GRANT override adds a permission', async () => {
    prisma.userPermission.findMany.mockResolvedValue([
      override('settings', 'view', 'GRANT'),
    ]);
    const result = await resolvePermissions('u1');
    expect(result.permissions).toContain('settings:view');
  });

  it('6. DENY override removes a role-granted permission', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'admin', permissions: [rolePerm('users', 'view'), rolePerm('users', 'delete')] } },
    ]);
    prisma.userPermission.findMany.mockResolvedValue([
      override('users', 'delete', 'DENY'),
    ]);
    const result = await resolvePermissions('u1');
    expect(result.permissions).toContain('users:view');
    expect(result.permissions).not.toContain('users:delete');
  });

  it('7. DENY wins over GRANT for the same permission', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'admin', permissions: [rolePerm('users', 'view')] } },
    ]);
    prisma.userPermission.findMany.mockResolvedValue([
      override('users', 'view', 'GRANT'),
      override('users', 'view', 'DENY'),
    ]);
    const result = await resolvePermissions('u1');
    expect(result.permissions).not.toContain('users:view');
  });

  it('8. caches the result and invalidates with SCAN', async () => {
    prisma.userRole.findMany.mockResolvedValue([
      { role: { slug: 'admin', permissions: [rolePerm('media', 'view')] } },
    ]);
    await resolvePermissions('u1');
    expect(redis.setex).toHaveBeenCalled();

    // Second call should hit Redis, not DB.
    prisma.userRole.findMany.mockClear();
    redis.get.mockResolvedValueOnce(JSON.stringify({ bypass: false, permissions: ['media:view'] }));
    const cached = await resolvePermissions('u1');
    expect(cached.permissions).toContain('media:view');
    expect(prisma.userRole.findMany).not.toHaveBeenCalled();

    await invalidatePermissionCache();
    expect(redis.del).toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });

  it('returns empty permissions for inactive or deleted users', async () => {
    mockUser('SUSPENDED');
    let result = await resolvePermissions('u1');
    expect(result.permissions).toHaveLength(0);

    mockUser('ACTIVE', new Date());
    result = await resolvePermissions('u1');
    expect(result.permissions).toHaveLength(0);
  });
});
