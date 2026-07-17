import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/config/database.js';
import authRoutes from '../../src/modules/auth/routes.js';
import { agent } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    userRole: { findMany: vi.fn(() => Promise.resolve([])) },
    refreshToken: { create: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn() },
    passwordResetToken: { findFirst: vi.fn() },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}));

const makeApp = () => agent([{ path: '/api/auth', router: authRoutes }]);

const passwordHash = (pw) => bcrypt.hashSync(pw, 12);

const mockUser = (overrides = {}) => ({
  id: 'usr_seed_1',
  name: 'Super Admin',
  email: 'admin@kdl.com',
  password_hash: passwordHash('SeedPass@123'),
  is_active: true,
  must_change_password: false,
  status: 'ACTIVE',
  deleted_at: null,
  roles: [],
  ...overrides,
});

const accessToken = (userId = 'usr_seed_1') =>
  jwt.sign({ userId, email: 'admin@kdl.com', roles: [], type: 'access' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    issuer: process.env.JWT_ISSUER || 'kdl-os',
    audience: process.env.JWT_AUDIENCE || 'kdl-os-api',
    expiresIn: '15m',
  });

describe('M4 forced-password-change flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' });
    prisma.userRole.findMany.mockResolvedValue([]);
  });

  describe('login with must_change_password=true', () => {
    it('returns 200 with mustChangePassword flag and issues tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/login')
        .send({ email: 'admin@kdl.com', password: 'SeedPass@123' });

      expect(res.status).toBe(200);
      expect(res.body.data.mustChangePassword).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it('sets auth cookies even when mustChangePassword is true', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/login')
        .send({ email: 'admin@kdl.com', password: 'SeedPass@123' });

      const cookies = Array.isArray(res.headers['set-cookie']) ? res.headers['set-cookie'] : [];
      expect(cookies.some((c) => c.startsWith('kdl-auth-token='))).toBe(true);
    });

    it('returns 200 without mustChangePassword flag for normal users', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: false }));

      const res = await makeApp()
        .post('/api/auth/login')
        .send({ email: 'admin@kdl.com', password: 'SeedPass@123' });

      expect(res.status).toBe(200);
      expect(res.body.data.mustChangePassword).toBeUndefined();
    });
  });

  describe('authenticate middleware blocking', () => {
    it('blocks any authenticated route when must_change_password=true', async () => {
      prisma.user.findUnique.mockResolvedValue(
        mockUser({ must_change_password: true }),
      );

      const token = accessToken();
      const res = await makeApp()
        .get('/api/auth/me/permissions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.errors?.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });
  });

  describe('POST /auth/change-password', () => {
    it('accepts a valid current password and changes it', async () => {
      // findUnique called twice: once in authenticate middleware, once in changePassword service
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser({ must_change_password: true }))
        .mockResolvedValueOnce(mockUser({ must_change_password: true }));
      prisma.$transaction.mockResolvedValueOnce([{}, {}]);
      prisma.userRole.findMany.mockResolvedValue([]);

      const token = accessToken();
      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'SeedPass@123', newPassword: 'NewSecure@456' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Password changed successfully');
      expect(res.body.data.accessToken).toBeTruthy();
    });

    it('rejects wrong current password with 401', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser({ must_change_password: true }))
        .mockResolvedValueOnce(mockUser({ must_change_password: true }));

      const token = accessToken();
      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'WrongPassword!', newPassword: 'NewSecure@456' });

      expect(res.status).toBe(401);
    });

    it('rejects when new password equals current password', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const token = accessToken();
      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'SeedPass@123', newPassword: 'SeedPass@123' });

      expect(res.status).toBe(422);
    });

    it('rejects when no token provided', async () => {
      const res = await makeApp()
        .post('/api/auth/change-password')
        .send({ currentPassword: 'SeedPass@123', newPassword: 'NewSecure@456' });

      expect(res.status).toBe(401);
    });

    it('is accessible even when must_change_password=true (unlike other routes)', async () => {
      // Verify that authenticateAllowPendingPasswordChange is used (not authenticate)
      prisma.user.findUnique
        .mockResolvedValueOnce(mockUser({ must_change_password: true }))
        .mockResolvedValueOnce(mockUser({ must_change_password: true }));
      prisma.$transaction.mockResolvedValueOnce([{}, {}]);

      const token = accessToken();
      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ currentPassword: 'SeedPass@123', newPassword: 'DifferentPass@789' });

      // Must NOT return 403 PASSWORD_CHANGE_REQUIRED
      expect(res.status).not.toBe(403);
    });
  });
});
