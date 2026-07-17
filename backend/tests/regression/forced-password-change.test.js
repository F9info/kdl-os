import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database.js';
import authRoutes from '../../src/modules/auth/routes.js';
import { authenticate } from '../../src/middleware/auth.js';
import { agent, bearer, cookieValue } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
    userRole: { findMany: vi.fn(() => Promise.resolve([])) },
    refreshToken: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock('../../src/config/redis.js', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), del: vi.fn() },
}));

vi.mock('../../src/shared/queues/email.queue.js', () => ({
  emailQueue: { add: vi.fn().mockResolvedValue({}) },
}));

const protectedRouter = Router();
protectedRouter.get('/protected', authenticate, (_req, res) =>
  res.json({ success: true, data: 'secret' }),
);

const makeApp = () =>
  agent([
    { path: '/api/auth', router: authRoutes },
    { path: '/api', router: protectedRouter },
  ]);

const passwordHash = (password) => bcrypt.hashSync(password, 4);

const mockUser = (overrides = {}) => ({
  id: 'usr_1',
  name: 'Seed Admin',
  email: 'admin@kdl.com',
  password_hash: passwordHash('SeededPass123!'),
  is_active: true,
  status: 'ACTIVE',
  deleted_at: null,
  must_change_password: false,
  roles: [],
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('forced password change on first login (KDL-283)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' });
  });

  describe('authenticate gate', () => {
    it('blocks every protected route while must_change_password is set', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .get('/api/protected')
        .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }));

      expect(res.status).toBe(403);
      expect(res.body.errors.code).toBe('PASSWORD_CHANGE_REQUIRED');
    });

    it('allows protected routes once the flag is cleared', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());

      const res = await makeApp()
        .get('/api/protected')
        .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }));

      expect(res.status).toBe(200);
      expect(res.body.data).toBe('secret');
    });
  });

  describe('login', () => {
    it('returns must_change_password so the frontend can route to the change screen', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/login')
        .send({ email: 'admin@kdl.com', password: 'SeededPass123!' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.must_change_password).toBe(true);
      expect(res.body.data.user.password_hash).toBeUndefined();
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('is reachable while the flag is set, clears it, and revokes old refresh tokens', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }))
        .send({ currentPassword: 'SeededPass123!', newPassword: 'MyOwnPassword456!' });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeTruthy();

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'usr_1' },
          data: expect.objectContaining({ must_change_password: false }),
        }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_id: 'usr_1' }, data: { revoked: true } }),
      );
      // Fresh session for this client after the global revoke.
      expect(cookieValue(res, 'kdl-auth-token')).toBeTruthy();
      expect(cookieValue(res, 'kdl-refresh-token')).toBeTruthy();
    });

    it('rejects a wrong current password without touching the account', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }))
        .send({ currentPassword: 'wrong-password', newPassword: 'MyOwnPassword456!' });

      expect(res.status).toBe(401);
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('rejects reusing the current password (validation)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser({ must_change_password: true }));

      const res = await makeApp()
        .post('/api/auth/change-password')
        .set('Authorization', bearer({ userId: 'usr_1', email: 'admin@kdl.com' }))
        .send({ currentPassword: 'SeededPass123!', newPassword: 'SeededPass123!' });

      expect(res.status).toBe(422);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('requires authentication', async () => {
      const res = await makeApp()
        .post('/api/auth/change-password')
        .send({ currentPassword: 'a', newPassword: 'MyOwnPassword456!' });

      expect(res.status).toBe(401);
    });
  });

  describe('reset-password flow', () => {
    it('clears must_change_password when a reset token is redeemed', async () => {
      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        user: mockUser({ must_change_password: true }),
      });
      prisma.passwordResetToken.update.mockResolvedValue({});

      const res = await makeApp()
        .post('/api/auth/reset-password')
        .send({ token: 'raw-reset-token', password: 'MyOwnPassword456!' });

      expect(res.status).toBe(200);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ must_change_password: false }),
        }),
      );
    });
  });
});
