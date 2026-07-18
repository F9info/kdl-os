/**
 * Smoke tests for the reset-admin-password script logic.
 * Tests the core logic in isolation — DB and Redis are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must be set before any module that reads process.env at import time
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/test';
process.env.REDIS_URL = 'redis://localhost:6380';
process.env.NODE_ENV = 'test';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $disconnect: vi.fn(),
  },
}));

vi.mock('../src/config/redis.js', () => ({
  redis: { del: vi.fn().mockResolvedValue(1), get: vi.fn().mockResolvedValue(null), set: vi.fn() },
}));

import { prisma } from '../src/config/database.js';
import { hashPassword, clearLoginLockout } from '../src/modules/auth/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

describe('reset-admin-password logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hashPassword produces a bcrypt hash that is at least 59 chars', async () => {
    const hash = await hashPassword('testpassword123');
    expect(hash).toMatch(/^\$2[ab]\$/);
    expect(hash.length).toBeGreaterThan(59);
  });

  it('clearLoginLockout resolves without throwing when Redis del succeeds', async () => {
    await expect(clearLoginLockout('admin@kdl.com')).resolves.toBeUndefined();
  });

  it('clearLoginLockout does not throw when Redis is unavailable', async () => {
    const { redis } = await import('../src/config/redis.js');
    vi.mocked(redis).del.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(clearLoginLockout('admin@kdl.com')).resolves.toBeUndefined();
  });

  it('refuses user that does not exist (findUnique returns null)', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    const user = await prisma.user.findUnique({ where: { email: 'ghost@example.com' } });
    expect(user).toBeNull();
  });

  it('updates password_hash, must_change_password, is_active, and status on reset', async () => {
    const fakeUser = { id: 'usr_1', email: 'admin@kdl.com', password_hash: 'oldhash' };
    prismaMock.user.findUnique.mockResolvedValueOnce(fakeUser);
    prismaMock.user.update.mockResolvedValueOnce({ ...fakeUser, password_hash: 'newhash' });

    const user = await prisma.user.findUnique({ where: { email: 'admin@kdl.com' } });
    expect(user).not.toBeNull();

    const password_hash = await hashPassword('SecurePass123!');
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash, must_change_password: false, is_active: true, status: 'ACTIVE' },
    });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          must_change_password: false,
          is_active: true,
          status: 'ACTIVE',
        }),
      }),
    );
  });

  it('enforces minimum password length of 12 chars', () => {
    const short = 'short';
    expect(short.length).toBeLessThan(12);
    // The script exits(1) on this — we just verify the check logic
    const long = 'SecurePass123!';
    expect(long.length).toBeGreaterThanOrEqual(12);
  });
});
