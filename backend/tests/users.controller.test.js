import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/users/service.js', () => ({
  __esModule: true,
  listUsers: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  softDeleteUser: vi.fn(),
  resetPassword: vi.fn(),
  updateUserOverrides: vi.fn(),
  roleIdsIncludeSuperAdmin: vi.fn(),
  getUserRoleSlugs: vi.fn(),
}));

vi.mock('../src/modules/user-management/shared/activity-logger.js', () => ({
  __esModule: true,
  writeActivityAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../src/modules/user-management/shared/permission-resolver.js', () => ({
  __esModule: true,
  invalidatePermissionCache: vi.fn(),
}));

import * as userService from '../src/modules/users/service.js';
import { invalidatePermissionCache } from '../src/modules/user-management/shared/permission-resolver.js';
import { writeActivityAsync, getClientIp } from '../src/modules/user-management/shared/activity-logger.js';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  updateOverrides,
} from '../src/modules/users/controller.js';

const serviceMock = vi.mocked(userService, { deep: true });

function mockRes() {
  const res = { statusCode: 200, jsonBody: null };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.jsonBody = body;
    return res;
  });
  return res;
}

function mockReq(overrides = {}) {
  return {
    user: { id: 'admin1', role: 'ADMIN' },
    validated: { params: {}, body: {}, query: {} },
    headers: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('users controller regression', () => {
  it('ADMIN cannot assign SUPER_ADMIN role (KDL-14 HIGH)', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    const req = mockReq({ validated: { params: { id: 'u2' }, body: { role: 'SUPER_ADMIN' } } });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody.success).toBe(false);
    expect(res.jsonBody.message).toMatch(/ADMIN cannot assign SUPER_ADMIN/i);
    expect(serviceMock.updateUser).not.toHaveBeenCalled();
  });

  it('ADMIN cannot modify an existing SUPER_ADMIN user (KDL-14 HIGH)', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u3', role: 'SUPER_ADMIN', roles: [] });
    const req = mockReq({ validated: { params: { id: 'u3' }, body: { name: 'X' } } });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.updateUser).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN can assign SUPER_ADMIN role', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    serviceMock.updateUser.mockResolvedValue({ id: 'u2', role: 'SUPER_ADMIN', roles: [] });
    const req = mockReq({
      user: { id: 'super1', role: 'SUPER_ADMIN' },
      validated: { params: { id: 'u2' }, body: { role: 'SUPER_ADMIN' } },
    });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(serviceMock.updateUser).toHaveBeenCalledWith('u2', { role: 'SUPER_ADMIN' });
  });

  it('ADMIN cannot delete a SUPER_ADMIN user (KDL-14 HIGH)', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u3', role: 'SUPER_ADMIN', roles: [] });
    const req = mockReq({ validated: { params: { id: 'u3' }, body: {} } });
    const res = mockRes();
    await deleteUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.softDeleteUser).not.toHaveBeenCalled();
  });
});

describe('users controller — Step 4 extensions', () => {
  it('lists users with filters', async () => {
    serviceMock.listUsers.mockResolvedValue({
      users: [{ id: 'u1', name: 'A', email: 'a@b.com', roles: [] }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    const req = mockReq({ validated: { query: { status: 'ACTIVE', role: 'admin', search: 'a' } } });
    const res = mockRes();
    await listUsers(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(serviceMock.listUsers).toHaveBeenCalledWith({
      status: 'ACTIVE',
      role: 'admin',
      search: 'a',
    });
  });

  it('returns 404 when user is not found', async () => {
    serviceMock.getUserById.mockResolvedValue(null);
    const req = mockReq({ validated: { params: { id: 'missing' } } });
    const res = mockRes();
    await getUser(req, res, vi.fn());

    expect(res.statusCode).toBe(404);
  });

  it('creates a user and logs activity', async () => {
    const body = { name: 'New', email: 'new@kdl.com', password: 'Secret123!' };
    serviceMock.roleIdsIncludeSuperAdmin.mockResolvedValue(false);
    serviceMock.createUser.mockResolvedValue({ id: 'u9', ...body, roles: [] });
    const req = mockReq({ validated: { body } });
    const res = mockRes();
    await createUser(req, res, vi.fn());

    expect(res.statusCode).toBe(201);
    expect(serviceMock.createUser).toHaveBeenCalledWith(body);
    expect(writeActivityAsync).toHaveBeenCalled();
  });

  it('blocks non-super-admin from creating a super-admin user via role_ids', async () => {
    const body = { name: 'New', email: 'new@kdl.com', password: 'Secret123!', role_ids: ['r1'] };
    serviceMock.roleIdsIncludeSuperAdmin.mockResolvedValue(true);
    const req = mockReq({ validated: { body } });
    const res = mockRes();
    await createUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.createUser).not.toHaveBeenCalled();
  });

  it('blocks non-super-admin from assigning super-admin role via role_ids', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    serviceMock.roleIdsIncludeSuperAdmin.mockResolvedValue(true);
    const req = mockReq({
      validated: { params: { id: 'u2' }, body: { role_ids: ['r1'] } },
    });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.updateUser).not.toHaveBeenCalled();
  });

  it('prevents a user from deleting their own account', async () => {
    const req = mockReq({ user: { id: 'u1', role: 'SUPER_ADMIN' }, validated: { params: { id: 'u1' } } });
    const res = mockRes();
    await deleteUser(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(serviceMock.getUserById).not.toHaveBeenCalled();
  });

  it('soft-deletes a user and invalidates permission cache', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    serviceMock.softDeleteUser.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    const req = mockReq({ validated: { params: { id: 'u2' } } });
    const res = mockRes();
    await deleteUser(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(serviceMock.softDeleteUser).toHaveBeenCalledWith('u2');
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });

  it('resets a user password and invalidates permission cache', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    serviceMock.resetPassword.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    const req = mockReq({ validated: { params: { id: 'u2' }, body: { password: 'NewPass1!' } } });
    const res = mockRes();
    await resetPassword(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(serviceMock.resetPassword).toHaveBeenCalledWith('u2', 'NewPass1!');
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });

  it('updates user overrides and invalidates permission cache', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    serviceMock.updateUserOverrides.mockResolvedValue({ id: 'u2', role: 'USER', roles: [] });
    const overrides = [{ permission_id: 'p1', mode: 'GRANT' }];
    const req = mockReq({ validated: { params: { id: 'u2' }, body: { overrides } } });
    const res = mockRes();
    await updateOverrides(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(serviceMock.updateUserOverrides).toHaveBeenCalledWith('u2', overrides);
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });
});
