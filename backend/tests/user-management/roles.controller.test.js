import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/user-management/roles/service.js', () => ({
  __esModule: true,
  listRoles: vi.fn(),
  getRoleById: vi.fn(),
  createRole: vi.fn(),
  updateRole: vi.fn(),
  countRoleUsers: vi.fn(),
  deleteRole: vi.fn(),
}));

vi.mock('../../src/modules/user-management/shared/activity-logger.js', () => ({
  __esModule: true,
  writeActivity: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../../src/modules/user-management/shared/permission-resolver.js', () => ({
  __esModule: true,
  invalidatePermissionCache: vi.fn(),
}));

import * as roleService from '../../src/modules/user-management/roles/service.js';
import { writeActivity, getClientIp } from '../../src/modules/user-management/shared/activity-logger.js';
import { invalidatePermissionCache } from '../../src/modules/user-management/shared/permission-resolver.js';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from '../../src/modules/user-management/roles/controller.js';

const serviceMock = vi.mocked(roleService, { deep: true });

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
    user: { id: 'u1' },
    validated: { params: {}, body: {}, query: {} },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('roles controller — Step 3', () => {
  it('lists roles with pagination', async () => {
    serviceMock.listRoles.mockResolvedValue({
      roles: [{ id: 'r1', name: 'Admin', user_count: 2, permission_count: 5 }],
      pagination: { page: 1, limit: 20, total: 1, pages: 1 },
    });
    const req = mockReq({ validated: { query: { page: '1', limit: '20' } } });
    const res = mockRes();
    await listRoles(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.roles[0].user_count).toBe(2);
  });

  it('returns 404 for missing role', async () => {
    serviceMock.getRoleById.mockResolvedValue(null);
    const req = mockReq({ validated: { params: { id: 'notfound' } } });
    const res = mockRes();
    await getRole(req, res, vi.fn());

    expect(res.statusCode).toBe(404);
  });

  it('includes permission_matrix on get', async () => {
    serviceMock.getRoleById.mockResolvedValue({
      id: 'r1',
      name: 'Admin',
      permission_matrix: { 'users:view': 'p1' },
    });
    const req = mockReq({ validated: { params: { id: 'r1' } } });
    const res = mockRes();
    await getRole(req, res, vi.fn());

    expect(res.jsonBody.data.role.permission_matrix).toEqual({ 'users:view': 'p1' });
  });

  it('creates a role and invalidates cache', async () => {
    serviceMock.createRole.mockResolvedValue({ id: 'r2', name: 'Editor', slug: 'editor' });
    const req = mockReq({
      validated: { body: { name: 'Editor', permission_ids: ['p1', 'p2'] } },
    });
    const res = mockRes();
    await createRole(req, res, vi.fn());

    expect(res.statusCode).toBe(201);
    expect(invalidatePermissionCache).toHaveBeenCalled();
    expect(writeActivity).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'roles', action: 'created', subject_id: 'r2' }),
    );
  });

  it('handles duplicate role name with 409', async () => {
    const duplicateErr = new Error('Unique constraint');
    duplicateErr.code = 'P2002';
    serviceMock.createRole.mockRejectedValue(duplicateErr);
    const req = mockReq({ validated: { body: { name: 'Admin' } } });
    const res = mockRes();
    await createRole(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
  });

  it('rejects renaming a system role with 409', async () => {
    serviceMock.getRoleById.mockResolvedValue({ id: 'r1', name: 'Admin', is_system: true });
    const req = mockReq({ validated: { params: { id: 'r1' }, body: { name: 'Changed' } } });
    const res = mockRes();
    await updateRole(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(serviceMock.updateRole).not.toHaveBeenCalled();
  });

  it('updates a non-system role and invalidates cache', async () => {
    serviceMock.getRoleById.mockResolvedValue({ id: 'r2', name: 'Editor', is_system: false });
    serviceMock.updateRole.mockResolvedValue({ id: 'r2', name: 'Lead Editor' });
    const req = mockReq({
      validated: { params: { id: 'r2' }, body: { name: 'Lead Editor', permission_ids: ['p3'] } },
    });
    const res = mockRes();
    await updateRole(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });

  it('rejects deleting a system role with 409', async () => {
    serviceMock.getRoleById.mockResolvedValue({ id: 'r1', name: 'Admin', is_system: true });
    const req = mockReq({ validated: { params: { id: 'r1' } } });
    const res = mockRes();
    await deleteRole(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
  });

  it('rejects deleting a role with assigned users with 409', async () => {
    serviceMock.getRoleById.mockResolvedValue({ id: 'r2', name: 'Editor', is_system: false });
    serviceMock.countRoleUsers.mockResolvedValue(3);
    const req = mockReq({ validated: { params: { id: 'r2' } } });
    const res = mockRes();
    await deleteRole(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(res.jsonBody.message).toMatch(/users are assigned/i);
  });

  it('deletes an unused non-system role and invalidates cache', async () => {
    serviceMock.getRoleById.mockResolvedValue({ id: 'r2', name: 'Editor', is_system: false });
    serviceMock.countRoleUsers.mockResolvedValue(0);
    serviceMock.deleteRole.mockResolvedValue();
    const req = mockReq({ validated: { params: { id: 'r2' } } });
    const res = mockRes();
    await deleteRole(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });
});
