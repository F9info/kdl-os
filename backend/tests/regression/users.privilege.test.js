import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../../src/config/database.js';
import userRoutes from '../../src/modules/users/routes.js';
import { agent, bearer } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  __esModule: true,
  writeActivityAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../../src/modules/user-management/shared/permission-resolver.js', () => ({
  __esModule: true,
  resolvePermissions: vi.fn(),
  invalidatePermissionCache: vi.fn(),
}));

import { resolvePermissions } from '../../src/modules/user-management/shared/permission-resolver.js';

const makeApp = () => agent([{ path: '/api/users', router: userRoutes }]);

const mockUser = (overrides = {}) => ({
  id: overrides.id || 'usr_2',
  name: 'Bob',
  email: 'bob@example.com',
  role: overrides.role || 'USER',
  status: 'ACTIVE',
  deleted_at: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

const actorAdmin = { id: 'usr_admin', role: 'ADMIN', status: 'ACTIVE', deleted_at: null };
const adminPermissions = { bypass: false, permissions: ['users:view', 'users:add', 'users:edit', 'users:delete'] };

describe('user privilege escalation regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePermissions.mockResolvedValue(adminPermissions);
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      return Promise.resolve(null);
    });
  });

  it('ADMIN cannot assign SUPER_ADMIN role (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_target', role: 'USER' });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }))
      .send({ name: 'Bob', role: 'SUPER_ADMIN' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot modify a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', role: 'SUPER_ADMIN' });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }))
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot delete a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', role: 'SUPER_ADMIN' });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });

    const res = await makeApp()
      .delete(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', role: 'ADMIN' }));

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
