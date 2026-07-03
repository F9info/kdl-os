import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../../src/config/database.js';
import { emailQueue } from '../../src/shared/queues/email.queue.js';
import * as authService from '../../src/modules/auth/service.js';
import authRoutes from '../../src/modules/auth/routes.js';
import { agent, cookieAttributes, cookieValue } from '../helpers/app.js';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    userRole: { findMany: vi.fn(() => Promise.resolve([])) },
    refreshToken: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    passwordResetToken: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((ops) => Promise.all(ops)),
  },
}));

vi.mock('../../src/shared/queues/email.queue.js', () => ({
  emailQueue: { add: vi.fn().mockResolvedValue({}) },
}));

const makeApp = () => agent([{ path: '/api/auth', router: authRoutes }]);

const passwordHash = (password) => bcrypt.hashSync(password, 12);
const hashSha256 = (token) => crypto.createHash('sha256').update(token).digest('hex');

const mockUser = (overrides = {}) => ({
  id: 'usr_1',
  name: 'Alice',
  email: 'alice@example.com',
  password_hash: overrides.password_hash || passwordHash('Password123!'),
  role: overrides.role || 'USER',
  is_active: overrides.is_active !== undefined ? overrides.is_active : true,
  created_at: new Date().toISOString(),
});

describe('auth security regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login cookie flags', () => {
    it('sets httpOnly and SameSite cookies (regression C1/C2 token storage)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser());
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt1' });

      const res = await makeApp()
        .post('/api/auth/login')
        .send({ email: 'alice@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      const access = cookieAttributes(res, 'kdl-auth-token');
      const refresh = cookieAttributes(res, 'kdl-refresh-token');
      expect(access.httponly).toBe(true);
      expect(refresh.httponly).toBe(true);
      expect(access.samesite.toLowerCase()).toBe('lax');
      expect(refresh.samesite.toLowerCase()).toBe('strict');
      expect(access.secure).toBeUndefined();
    });
  });

  describe('refresh token rotation', () => {
    it('revokes the used refresh token and issues a new one (regression KDL-15)', async () => {
      const user = mockUser();
      const oldToken = authService.signRefreshToken({ userId: user.id });
      const oldHash = hashSha256(oldToken);

      prisma.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        token_hash: oldHash,
        user,
      });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt2' });

      const res = await makeApp()
        .post('/api/auth/refresh')
        .set('Cookie', `kdl-refresh-token=${encodeURIComponent(oldToken)}`)
        .send({});

      expect(res.status).toBe(200);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { token_hash: oldHash }, data: { revoked: true } })
      );
      expect(prisma.refreshToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ user_id: user.id }),
        })
      );
      const newCookie = cookieValue(res, 'kdl-refresh-token');
      expect(newCookie).toBeTruthy();
      expect(newCookie).not.toBe(oldToken);
    });
  });

  describe('forgot-password', () => {
    it('returns generic success for unknown email and does not queue mail', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await makeApp()
        .post('/api/auth/forgot-password')
        .send({ email: 'missing@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toMatch(/reset link has been sent/i);
      expect(emailQueue.add).not.toHaveBeenCalled();
    });

    it('queues reset email for active known users and still returns generic success', async () => {
      const user = mockUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({ id: 'prt1' });

      const res = await makeApp()
        .post('/api/auth/forgot-password')
        .send({ email: user.email });

      expect(res.status).toBe(200);
      expect(emailQueue.add).toHaveBeenCalledTimes(1);
      expect(emailQueue.add).toHaveBeenCalledWith(
        'password-reset',
        expect.objectContaining({ to: user.email })
      );
    });
  });

  describe('reset-password', () => {
    it('updates user password and consumes the reset token', async () => {
      const user = mockUser();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashSha256(rawToken);

      prisma.passwordResetToken.findFirst.mockResolvedValue({
        id: 'prt1',
        token_hash: tokenHash,
        used: false,
        user,
      });
      prisma.user.update.mockResolvedValue({ ...user, password_hash: 'new-hash' });

      const res = await makeApp()
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'NewPassword123!' });

      expect(res.status).toBe(200);
      expect(prisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ used: true }) })
      );
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: user.id },
          data: expect.objectContaining({ password_hash: expect.any(String) }),
        })
      );
    });
  });
});
