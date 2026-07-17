import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/modules/user-management/shared/permission-resolver.js', () => ({
  __esModule: true,
  resolvePermissions: vi.fn(),
}));

vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: {
      update: vi.fn(() => Promise.resolve()),
    },
  },
}));

process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';

vi.mock('../src/modules/auth/service.js', () => {
  const mocks = {
    findUserByEmail: vi.fn(),
    findUserWithRolesByEmail: vi.fn(),
    comparePassword: vi.fn(),
    signAccessToken: vi.fn(() => 'access-token'),
    signRefreshToken: vi.fn(() => 'refresh-token'),
    storeRefreshToken: vi.fn(),
    getRefreshTokensCandidates: vi.fn(),
    verifyRefreshToken: vi.fn(),
    findValidRefreshToken: vi.fn(),
    findAnyRefreshTokenByHash: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllRefreshTokensForUser: vi.fn(),
    revokeFamilyById: vi.fn(),
    getUserRoleSlugs: vi.fn(() => Promise.resolve([])),
    createPasswordResetToken: vi.fn(),
    resetPassword: vi.fn(),
    createUser: vi.fn(),
    // M1: per-account lockout (return no lockout by default)
    checkAccountLockout: vi.fn().mockResolvedValue(null),
    recordFailedLoginAttempt: vi.fn().mockResolvedValue(null),
    clearLoginLockout: vi.fn().mockResolvedValue(undefined),
    // L3: dummy hash constant for timing protection
    DUMMY_HASH: '$2a$12$test-dummy-hash-for-timing-protection',
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
  getMyPermissions,
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
    // Reset lockout check to return no lockout by default
    serviceMock.checkAccountLockout.mockResolvedValue(null);
  });

  describe('login', () => {
    it('rejects invalid credentials', async () => {
      serviceMock.findUserWithRolesByEmail.mockResolvedValue(null);
      const req = mockReq({ validated: { body: { email: 'x@kdl.com', password: 'x' } } });
      const res = mockRes();
      const next = vi.fn();
      await login(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(res.jsonBody.success).toBe(false);
    });

    it('issues httpOnly cookies on successful login', async () => {
      serviceMock.findUserWithRolesByEmail.mockResolvedValue(okUser);
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

    it('rejects suspended users and still runs constant-time compare (L3)', async () => {
      serviceMock.findUserWithRolesByEmail.mockResolvedValue({
        ...okUser,
        status: 'SUSPENDED',
      });
      serviceMock.comparePassword.mockResolvedValue(false);
      const req = mockReq({ validated: { body: { email: okUser.email, password: 'pass' } } });
      const res = mockRes();
      await login(req, res, vi.fn());
      expect(res.statusCode).toBe(401);
      // L3: comparePassword is always called even for suspended/missing users (timing protection)
      expect(serviceMock.comparePassword).toHaveBeenCalledWith('pass', authService.DUMMY_HASH);
    });

    it('returns 429 when account is locked out (M1)', async () => {
      serviceMock.checkAccountLockout.mockResolvedValue(Date.now() + 60_000);
      const req = mockReq({ validated: { body: { email: 'locked@kdl.com', password: 'x' } } });
      const res = mockRes();
      await login(req, res, vi.fn());
      expect(res.statusCode).toBe(429);
    });
  });

  describe('refresh-token rotation (KDL-14 MEDIUM / M3)', () => {
    it('rotates the refresh token on use', async () => {
      // H1: verifyRefreshToken returns payload with type:'refresh'
      serviceMock.verifyRefreshToken.mockImplementation(() => ({ type: 'refresh', userId: 'u1' }));
      // M3: findAnyRefreshTokenByHash returns non-revoked record
      serviceMock.findAnyRefreshTokenByHash.mockResolvedValue({
        id: 'rt1',
        revoked: false,
        family_id: 'fam-1',
        expires_at: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'u@kdl.com', role: 'USER', is_active: true },
      });
      serviceMock.signAccessToken.mockReturnValue('new-access');
      serviceMock.signRefreshToken.mockReturnValue('new-refresh');

      const req = mockReq({ headers: { cookie: 'kdl-refresh-token=oldtoken' } });
      const res = mockRes();
      const next = vi.fn();
      await refresh(req, res, next);

      expect(serviceMock.revokeRefreshToken).toHaveBeenCalledWith('oldtoken');
      expect(serviceMock.storeRefreshToken).toHaveBeenCalledWith('u1', 'new-refresh', 'fam-1');
      expect(res.jsonBody.data.accessToken).toBe('new-access');
      const refreshCookie = res.cookieCalls.find((c) => c[0] === 'kdl-refresh-token');
      expect(refreshCookie[1]).toBe('new-refresh');
    });

    it('revokes the whole family when a revoked token is replayed (M3)', async () => {
      serviceMock.verifyRefreshToken.mockImplementation(() => ({ type: 'refresh', userId: 'u1' }));
      serviceMock.findAnyRefreshTokenByHash.mockResolvedValue({
        id: 'rt1',
        revoked: true,
        family_id: 'fam-stolen',
        user_id: 'u1',
      });

      const req = mockReq({ headers: { cookie: 'kdl-refresh-token=stolentoken' } });
      const res = mockRes();
      await refresh(req, res, vi.fn());

      expect(serviceMock.revokeFamilyById).toHaveBeenCalledWith('fam-stolen');
      expect(res.statusCode).toBe(401);
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
