import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.JWT_SECRET = 'test-jwt-secret-min-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (ops) => {
      for (const op of ops) await op;
    }),
  },
}));

vi.mock('../src/shared/queues/email.queue.js', () => ({
  emailQueue: { add: vi.fn() },
}));

import { prisma } from '../src/config/database.js';
import { emailQueue } from '../src/shared/queues/email.queue.js';
import {
  hashPassword,
  comparePassword,
  signAccessToken,
  signRefreshToken,
  findUserByEmail,
  createUser,
  storeRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  createPasswordResetToken,
  findValidPasswordResetToken,
  resetPassword,
} from '../src/modules/auth/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });
const emailQueueMock = vi.mocked(emailQueue, { deep: true });

describe('auth service regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('password hashing', () => {
    it('hashes and verifies passwords', async () => {
      const hash = await hashPassword('ValidPass1!');
      expect(hash).not.toBe('ValidPass1!');
      expect(await comparePassword('ValidPass1!', hash)).toBe(true);
      expect(await comparePassword('wrong', hash)).toBe(false);
    });
  });

  describe('forgot-password flow (KDL-14/KDL-6)', () => {
    it('creates a reset token and enqueues a password-reset email', async () => {
      const user = { id: 'u1', email: 'user@kdl.com', name: 'User', is_active: true };
      prismaMock.user.findUnique.mockResolvedValue(user);
      prismaMock.passwordResetToken.create.mockResolvedValue({ id: 'rt1' });

      const result = await createPasswordResetToken(user.email);

      expect(result.user).toEqual(user);
      expect(result.token).toBeTypeOf('string');
      expect(result.token.length).toBe(64);
      expect(prismaMock.passwordResetToken.create).toHaveBeenCalledOnce();
      expect(emailQueueMock.add).toHaveBeenCalledOnce();
      const job = emailQueueMock.add.mock.calls[0];
      expect(job[0]).toBe('password-reset');
      expect(job[1].to).toBe(user.email);
      expect(job[1].html).toContain('reset-password?token=');
    });

    it('does not leak whether an email exists for inactive users', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'u2', is_active: false });

      const result = await createPasswordResetToken('missing@kdl.com');

      expect(result.user).toBeNull();
      expect(result.token).toBeNull();
      expect(prismaMock.passwordResetToken.create).not.toHaveBeenCalled();
      expect(emailQueueMock.add).not.toHaveBeenCalled();
    });

    it('resets the password and marks the token used', async () => {
      const user = { id: 'u1', email: 'user@kdl.com', is_active: true };
      prismaMock.passwordResetToken.findFirst.mockResolvedValue({
        id: 'rt1',
        used: false,
        user,
      });

      const updated = await resetPassword('rawtokendoesnotmatter', 'NewPass1!');

      expect(updated).toEqual(user);
      expect(prismaMock.user.update).toHaveBeenCalledOnce();
      expect(prismaMock.passwordResetToken.update).toHaveBeenCalledOnce();
      const pwdData = prismaMock.user.update.mock.calls[0][0].data;
      expect(pwdData.password_hash).not.toBe('NewPass1!');
      const tokenData = prismaMock.passwordResetToken.update.mock.calls[0][0].data;
      expect(tokenData.used).toBe(true);
    });

    it('returns null when reset token is invalid or used', async () => {
      prismaMock.passwordResetToken.findFirst.mockResolvedValue(null);
      const result = await resetPassword('badtoken', 'NewPass1!');
      expect(result).toBeNull();
    });
  });

  describe('refresh-token rotation (KDL-14 MEDIUM)', () => {
    it('stores, finds, and revokes refresh tokens using sha256 hashes', async () => {
      const userId = 'u1';
      const token = signRefreshToken({ userId });

      prismaMock.refreshToken.create.mockResolvedValue({ id: 'rt1' });
      await storeRefreshToken(userId, token);
      expect(prismaMock.refreshToken.create).toHaveBeenCalledOnce();
      const created = prismaMock.refreshToken.create.mock.calls[0][0].data;
      expect(created.token_hash.length).toBe(64);
      expect(created.user_id).toBe(userId);
      expect(created.expires_at).toBeInstanceOf(Date);

      prismaMock.refreshToken.findFirst.mockResolvedValue({
        id: 'rt1',
        user: { id: userId, email: 'u@kdl.com', role: 'USER', is_active: true },
      });
      const found = await findValidRefreshToken(token);
      expect(found).toBeTruthy();

      await revokeRefreshToken(token);
      expect(prismaMock.refreshToken.updateMany).toHaveBeenCalledOnce();
    });

    it('generates refresh tokens with unique jti so token hashes differ even in same second', () => {
      const t1 = signRefreshToken({ userId: 'u1' });
      const t2 = signRefreshToken({ userId: 'u1' });
      expect(t1).not.toBe(t2);
    });
  });
});
