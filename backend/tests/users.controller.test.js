import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/users/service.js', () => ({
  __esModule: true,
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  softDeleteUser: vi.fn(),
}));

import * as userService from '../src/modules/users/service.js';
import {
  updateUser,
  deleteUser,
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
    ...overrides,
  };
}

describe('users controller regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ADMIN cannot assign SUPER_ADMIN role (KDL-14 HIGH)', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER' });
    const req = mockReq({ validated: { params: { id: 'u2' }, body: { role: 'SUPER_ADMIN' } } });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(res.jsonBody.success).toBe(false);
    expect(res.jsonBody.message).toMatch(/ADMIN cannot assign SUPER_ADMIN/i);
    expect(serviceMock.updateUser).not.toHaveBeenCalled();
  });

  it('ADMIN cannot modify an existing SUPER_ADMIN user (KDL-14 HIGH)', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u3', role: 'SUPER_ADMIN' });
    const req = mockReq({ validated: { params: { id: 'u3' }, body: { name: 'X' } } });
    const res = mockRes();
    await updateUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.updateUser).not.toHaveBeenCalled();
  });

  it('SUPER_ADMIN can assign SUPER_ADMIN role', async () => {
    serviceMock.getUserById.mockResolvedValue({ id: 'u2', role: 'USER' });
    serviceMock.updateUser.mockResolvedValue({ id: 'u2', role: 'SUPER_ADMIN' });
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
    serviceMock.getUserById.mockResolvedValue({ id: 'u3', role: 'SUPER_ADMIN' });
    const req = mockReq({ validated: { params: { id: 'u3' }, body: {} } });
    const res = mockRes();
    await deleteUser(req, res, vi.fn());

    expect(res.statusCode).toBe(403);
    expect(serviceMock.softDeleteUser).not.toHaveBeenCalled();
  });
});
