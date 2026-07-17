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
    rbacRole: {
      findFirst: vi.fn(),
    },
    rolePermission: {
      findMany: vi.fn(),
    },
    permission: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
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
  status: 'ACTIVE',
  deleted_at: null,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  roles: overrides.roles || [],
});

const superAdminRoles = [{ role: { id: 'r-super', name: 'Super Admin', slug: 'super-admin' } }];

const actorAdmin = { id: 'usr_admin', status: 'ACTIVE', deleted_at: null };
const adminPermissions = { bypass: false, permissions: ['users:view', 'users:add', 'users:edit', 'users:delete'] };

describe('user privilege escalation regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolvePermissions.mockResolvedValue(adminPermissions);
    prisma.rbacRole.findFirst.mockResolvedValue(null);
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      return Promise.resolve(null);
    });
  });

  it('ADMIN cannot assign super-admin role via role_ids (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_target' });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });
    prisma.rbacRole.findFirst.mockResolvedValue({ id: 'r-super' });

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', roles: ['admin'] }))
      .send({ role_ids: ['r-super'] });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot modify a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', roles: superAdminRoles });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', roles: ['admin'] }))
      .send({ name: 'Should Fail' });

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('ADMIN cannot delete a SUPER_ADMIN user (regression KDL-15)', async () => {
    const target = mockUser({ id: 'usr_super', roles: superAdminRoles });
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });

    const res = await makeApp()
      .delete(`/api/users/${target.id}`)
      .set('Authorization', bearer({ userId: 'usr_admin', email: 'admin@kdl.com', roles: ['admin'] }));

    expect(res.status).toBe(403);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('role assignment privilege ceiling (KDL-273 H3)', () => {
  const adminBearer = () => bearer({ userId: 'usr_admin', email: 'admin@kdl.com', roles: ['admin'] });

  const target = mockUser({ id: 'usr_target' });

  beforeEach(() => {
    vi.clearAllMocks();
    resolvePermissions.mockResolvedValue(adminPermissions);
    prisma.rbacRole.findFirst.mockResolvedValue(null);
    prisma.rolePermission.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });
  });

  it('rejects assigning a role whose permissions exceed the actor ceiling', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { action: 'delete', module: { name: 'media' } } },
    ]);

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', adminBearer())
      .send({ role_ids: ['r-media-manager'] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permissions you do not hold/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects assigning a role exceeding the ceiling at user creation', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { action: 'edit', module: { name: 'settings' } } },
    ]);

    const res = await makeApp()
      .post('/api/users')
      .set('Authorization', adminBearer())
      .send({
        name: 'New User',
        email: 'new@example.com',
        password: 'Str0ngPass!123',
        role_ids: ['r-settings-admin'],
      });

    expect(res.status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects modifying your own roles', async () => {
    const res = await makeApp()
      .patch(`/api/users/${actorAdmin.id}`)
      .set('Authorization', adminBearer())
      .send({ role_ids: ['r-user'] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/own roles/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows assigning a role within the actor ceiling', async () => {
    prisma.rolePermission.findMany.mockResolvedValue([
      { permission: { action: 'view', module: { name: 'users' } } },
    ]);
    const tx = {
      userRole: { deleteMany: vi.fn(), createMany: vi.fn(), create: vi.fn() },
      rbacRole: { findUnique: vi.fn().mockResolvedValue(null) },
      user: { update: vi.fn().mockResolvedValue({ ...target, roles: [] }) },
    };
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));

    const res = await makeApp()
      .patch(`/api/users/${target.id}`)
      .set('Authorization', adminBearer())
      .send({ role_ids: ['r-viewer'] });

    expect(res.status).toBe(200);
    expect(tx.userRole.createMany).toHaveBeenCalled();
  });
});

describe('permission override ceiling (KDL-273 H4)', () => {
  const editorPermissions = {
    bypass: false,
    permissions: ['permissions:edit', 'permissions:view', 'users:view'],
  };
  const editorBearer = () => bearer({ userId: 'usr_admin', email: 'admin@kdl.com', roles: ['admin'] });

  const target = mockUser({ id: 'usr_target' });

  beforeEach(() => {
    vi.clearAllMocks();
    resolvePermissions.mockResolvedValue(editorPermissions);
    prisma.permission.findMany.mockResolvedValue([]);
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.id === actorAdmin.id) return Promise.resolve(actorAdmin);
      if (where.id === target.id) return Promise.resolve(target);
      return Promise.resolve(null);
    });
  });

  it('rejects editing your own permission overrides', async () => {
    const res = await makeApp()
      .put(`/api/users/${actorAdmin.id}/overrides`)
      .set('Authorization', editorBearer())
      .send({ overrides: [{ permission_id: 'p-any', mode: 'GRANT' }] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/own permission overrides/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects granting a permission the actor does not hold', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p-media-delete', action: 'delete', module: { name: 'media' } },
    ]);

    const res = await makeApp()
      .put(`/api/users/${target.id}/overrides`)
      .set('Authorization', editorBearer())
      .send({ overrides: [{ permission_id: 'p-media-delete', mode: 'GRANT' }] });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/permissions you do not hold/i);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects granting an unknown permission id', async () => {
    prisma.permission.findMany.mockResolvedValue([]);

    const res = await makeApp()
      .put(`/api/users/${target.id}/overrides`)
      .set('Authorization', editorBearer())
      .send({ overrides: [{ permission_id: 'p-ghost', mode: 'GRANT' }] });

    expect(res.status).toBe(403);
  });

  it('allows DENY overrides and GRANTs within the actor ceiling', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p-users-view', action: 'view', module: { name: 'users' } },
    ]);
    const tx = {
      userPermission: { deleteMany: vi.fn(), createMany: vi.fn() },
      user: {
        findUnique: vi.fn().mockResolvedValue({
          ...target,
          roles: [],
          permission_overrides: [
            { permission: { id: 'p-users-view', module_id: 'm-users', action: 'view' }, mode: 'GRANT' },
            { permission: { id: 'p-media-view', module_id: 'm-media', action: 'view' }, mode: 'DENY' },
          ],
        }),
      },
    };
    prisma.$transaction.mockImplementation(async (fn) => fn(tx));

    const res = await makeApp()
      .put(`/api/users/${target.id}/overrides`)
      .set('Authorization', editorBearer())
      .send({
        overrides: [
          { permission_id: 'p-users-view', mode: 'GRANT' },
          { permission_id: 'p-media-view', mode: 'DENY' },
        ],
      });

    expect(res.status).toBe(200);
    expect(tx.userPermission.createMany).toHaveBeenCalled();
  });
});
