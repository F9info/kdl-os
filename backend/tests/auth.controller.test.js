import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';

vi.mock('../src/modules/auth/service.js', () => {
  const mocks = {
    findUserByEmail: vi.fn(),
    comparePassword: vi.fn(),
    signAccessToken: vi.fn(() => 'access-token'),
    signRefreshToken: vi.fn(() => 'refresh-token'),
    storeRefreshToken: vi.fn(),
    getRefreshTokensCandidates: vi.fn(),
    verifyRefreshToken: vi.fn(),
    findValidRefreshToken: vi.fn(),
    revokeRefreshToken: vi.fn(),
    createPasswordResetToken: vi.fn(),
    resetPassword: vi.fn(),
    createUser: vi.fn(),
  };
  return { __esModule: true, ...mocks };
});

import * as authService from '../src/modules/auth/service.js';
import {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
} from '../src/modules/auth/controller.js';

const serviceMock = vi.mocked(authService, { deep: true });

function mockRes() {
  const res = {
    statusCode: 200,
    jsonBody: null,
    cookieCalls: [],
    clearCookieCalls: [],
  };
  res.status = vi.fn((code) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((body) => {
    res.jsonBody = body;
    return res;
  });
  res.cookie = vi.fn((name, value, opts) => {
    res.cookieCalls.push([name, value, opts]);
    return res;
  });
  res.clearCookie = vi.fn((name, opts) => {
    res.clearCookieCalls.push([name, opts]);
    return res;
  });
  return res;
}

function mockReq(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    headers: {},
    validated: { body: {}, query: {}, params: {} },
    ...overrides,
  };
}

const okUser = {
  id: 'u1',
  email: 'user@kdl.com',
  role: 'USER',
  is_active: true,
  password_hash: 'hash',
};

describe('auth controller regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('rejects invalid credentials', async () => {
      serviceMock.findUserByEmail.mockResolvedValue(null);
      const req = mockReq({ validated: { body: { email: 'x@kdl.com', password: 'x' } } });
      const res = mockRes();
      const next = vi.fn();
      await login(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.jsonBody.success).toBe(false);
    });

    it('issues httpOnly cookies on successful login', async () => {
      serviceMock.findUserByEmail.mockResolvedValue(okUser);
      serviceMock.comparePassword.mockResolvedValue(true);
      const req = mockReq({ validated: { body: { email: okUser.email, password: 'pass' } } });
      const res = mockRes();
      await login(req, res, vi.fn());
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.success).toBe(true);
      expect(res.jsonBody.data.accessToken).toBe('access-token');
      const authCookie = res.cookieCalls.find((c) => c[0] === 'kdl-auth-token');
      const refreshCookie = res.cookieCalls.find((c) => c[0] === 'kdl-refresh-token');
      expect(authCookie[2].httpOnly).toBe(true);
      expect(authCookie[2].sameSite).toBe('lax');
      expect(refreshCookie[2].httpOnly).toBe(true);
      expect(refreshCookie[2].sameSite).toBe('strict');
    });
  });

  describe('refresh-token rotation (KDL-14 MEDIUM)', () => {
    it('rotates the refresh token on use', async () => {
      serviceMock.verifyRefreshToken.mockImplementation(() => true);
      serviceMock.findValidRefreshToken.mockResolvedValue({
        id: 'rt1',
        user: { id: 'u1', email: 'u@kdl.com', role: 'USER', is_active: true },
      });
      serviceMock.signAccessToken.mockReturnValue('new-access');
      serviceMock.signRefreshToken.mockReturnValue('new-refresh');

      const req = mockReq({ headers: { cookie: 'kdl-refresh-token=oldtoken' } });
      const res = mockRes();
      const next = vi.fn();
      await refresh(req, res, next);

      expect(serviceMock.revokeRefreshToken).toHaveBeenCalledWith('oldtoken');
      expect(serviceMock.storeRefreshToken).toHaveBeenCalledWith('u1', 'new-refresh');
      expect(res.jsonBody.data.accessToken).toBe('new-access');
      const refreshCookie = res.cookieCalls.find((c) => c[0] === 'kdl-refresh-token');
      expect(refreshCookie[1]).toBe('new-refresh');
    });
  });

  describe('forgot-password controller (KDL-6/KDL-14)', () => {
    it('returns generic message and does not leak existence', async () => {
      serviceMock.createPasswordResetToken.mockResolvedValue({ user: null, token: null });
      const req = mockReq({ validated: { body: { email: 'missing@kdl.com' } } });
      const res = mockRes();
      await forgotPassword(req, res, vi.fn());
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.data.message).toMatch(/If an account exists/i);
    });

    it('returns generic message even for valid users', async () => {
      serviceMock.createPasswordResetToken.mockResolvedValue({ user: okUser, token: 'tok' });
      const req = mockReq({ validated: { body: { email: okUser.email } } });
      const res = mockRes();
      await forgotPassword(req, res, vi.fn());
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.data.message).toMatch(/If an account exists/i);
    });
  });

  describe('reset-password controller (KDL-6/KDL-14)', () => {
    it('rejects invalid or expired tokens', async () => {
      serviceMock.resetPassword.mockResolvedValue(null);
      const req = mockReq({ validated: { body: { token: 'bad', password: 'NewPass1!' } } });
      const res = mockRes();
      await resetPassword(req, res, vi.fn());
      expect(res.statusCode).toBe(400);
      expect(res.jsonBody.success).toBe(false);
    });

    it('returns success on valid reset', async () => {
      serviceMock.resetPassword.mockResolvedValue(okUser);
      const req = mockReq({ validated: { body: { token: 'good', password: 'NewPass1!' } } });
      const res = mockRes();
      await resetPassword(req, res, vi.fn());
      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.data.message).toMatch(/Password reset/i);
    });
  });
});
