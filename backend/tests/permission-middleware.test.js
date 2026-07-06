import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn(),
}));

vi.mock('../src/modules/user-management/shared/activity-logger.js', () => ({
  getClientIp: vi.fn(() => '10.0.0.1'),
  writeActivityAsync: vi.fn(),
}));

import { resolvePermissions } from '../src/modules/user-management/shared/permission-resolver.js';
import { writeActivityAsync } from '../src/modules/user-management/shared/activity-logger.js';
import { requirePermission } from '../src/middleware/permission.js';

function mockReq(overrides = {}) {
  return {
    user: { id: 'u1', role: 'ADMIN' },
    headers: {},
    ip: '10.0.0.1',
    ...overrides,
  };
}

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requirePermission middleware', () => {
  it('returns 401 when req.user is missing', async () => {
    const middleware = requirePermission('users', 'view');
    const res = mockRes();
    const next = vi.fn();
    await middleware(mockReq({ user: null }), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.jsonBody.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next when the user has the requested permission', async () => {
    resolvePermissions.mockResolvedValue({
      bypass: false,
      permissions: ['users:view', 'users:edit'],
    });
    const middleware = requirePermission('users', 'view');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.userPermissions.permissions).toContain('users:view');
  });

  it('calls next for super-admin bypass', async () => {
    resolvePermissions.mockResolvedValue({ bypass: true, permissions: [] });
    const middleware = requirePermission('users', 'delete');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 and logs the denial when permission is missing', async () => {
    resolvePermissions.mockResolvedValue({
      bypass: false,
      permissions: ['users:view'],
    });
    const middleware = requirePermission('users', 'delete');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
    expect(writeActivityAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: 'u1',
        module: 'authz:users',
        action: 'permission_denied',
      }),
    );
  });

  it('passes resolver errors to next(err)', async () => {
    const err = new Error('DB timeout');
    resolvePermissions.mockRejectedValue(err);
    const middleware = requirePermission('users', 'view');
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();
    await middleware(req, res, next);
    expect(next).toHaveBeenCalledWith(err);
  });
});
