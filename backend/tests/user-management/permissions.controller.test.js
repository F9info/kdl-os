import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/user-management/permissions/service.js', () => ({
  __esModule: true,
  getPermissionMatrix: vi.fn(),
  getModuleById: vi.fn(),
  createModule: vi.fn(),
  updateModule: vi.fn(),
  countPermissionReferences: vi.fn(),
  deleteModule: vi.fn(),
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

import * as permissionService from '../../src/modules/user-management/permissions/service.js';
import { writeActivity } from '../../src/modules/user-management/shared/activity-logger.js';
import { invalidatePermissionCache } from '../../src/modules/user-management/shared/permission-resolver.js';
import {
  getMatrix,
  createModule,
  updateModule,
  deleteModule,
} from '../../src/modules/user-management/permissions/controller.js';

const serviceMock = vi.mocked(permissionService, { deep: true });

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

describe('permissions controller — matrix', () => {
  it('returns grouped matrix with actions ids', async () => {
    serviceMock.getPermissionMatrix.mockResolvedValue([
      { id: 'm1', name: 'users', label: 'Users', is_system: true, actions: { view: 'p1', add: 'p2' } },
    ]);
    const req = mockReq();
    const res = mockRes();
    await getMatrix(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(res.jsonBody.data.matrix).toHaveLength(1);
    expect(res.jsonBody.data.matrix[0].actions.view).toBe('p1');
    expect(res.jsonBody.data.matrix[0].actions).not.toHaveProperty('publish');
  });
});

describe('permissions controller — module mutations', () => {
  it('creates a module + permissions and invalidates cache', async () => {
    serviceMock.createModule.mockResolvedValue({
      module: { id: 'm2', name: 'blog', label: 'Blog' },
      permissions: [{ id: 'p10', action: 'view' }],
    });
    const req = mockReq({ validated: { body: { name: 'Blog', label: 'Blog' } } });
    const res = mockRes();
    await createModule(req, res, vi.fn());

    expect(res.statusCode).toBe(201);
    expect(invalidatePermissionCache).toHaveBeenCalled();
    expect(writeActivity).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'permissions', action: 'created', subject_id: 'm2' }),
    );
  });

  it('rejects renaming a system module with 409', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm1', name: 'users', is_system: true });
    const req = mockReq({ validated: { params: { id: 'm1' }, body: { name: 'Users2' } } });
    const res = mockRes();
    await updateModule(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(serviceMock.updateModule).not.toHaveBeenCalled();
  });

  it('updates a non-system module label without invalidating cache', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm2', name: 'blog', is_system: false });
    serviceMock.updateModule.mockResolvedValue({ id: 'm2', name: 'blog', label: 'Site Blog' });
    const req = mockReq({ validated: { params: { id: 'm2' }, body: { label: 'Site Blog' } } });
    const res = mockRes();
    await updateModule(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(invalidatePermissionCache).not.toHaveBeenCalled();
  });

  it('invalidates cache when non-system module name changes', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm2', name: 'blog', is_system: false });
    serviceMock.updateModule.mockResolvedValue({ id: 'm2', name: 'articles', label: 'Articles' });
    const req = mockReq({ validated: { params: { id: 'm2' }, body: { name: 'articles' } } });
    const res = mockRes();
    await updateModule(req, res, vi.fn());

    expect(invalidatePermissionCache).toHaveBeenCalled();
  });

  it('rejects deleting a system module with 409', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm1', name: 'users', is_system: true });
    const req = mockReq({ validated: { params: { id: 'm1' } } });
    const res = mockRes();
    await deleteModule(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
  });

  it('rejects deleting a module with referenced permissions with 409', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm2', name: 'blog', is_system: false });
    serviceMock.countPermissionReferences.mockResolvedValue({ roles: 1, users: 0 });
    const req = mockReq({ validated: { params: { id: 'm2' } } });
    const res = mockRes();
    await deleteModule(req, res, vi.fn());

    expect(res.statusCode).toBe(409);
    expect(serviceMock.deleteModule).not.toHaveBeenCalled();
  });

  it('deletes an unreferenced non-system module and invalidates cache', async () => {
    serviceMock.getModuleById.mockResolvedValue({ id: 'm2', name: 'blog', is_system: false });
    serviceMock.countPermissionReferences.mockResolvedValue({ roles: 0, users: 0 });
    serviceMock.deleteModule.mockResolvedValue();
    const req = mockReq({ validated: { params: { id: 'm2' } } });
    const res = mockRes();
    await deleteModule(req, res, vi.fn());

    expect(res.statusCode).toBe(200);
    expect(invalidatePermissionCache).toHaveBeenCalled();
  });
});
