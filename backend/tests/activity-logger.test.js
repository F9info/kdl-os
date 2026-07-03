import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    activityLog: { create: vi.fn() },
  },
}));

vi.mock('../src/shared/utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

import { prisma } from '../src/config/database.js';
import { logger } from '../src/shared/utils/logger.js';
import {
  getClientIp,
  writeActivity,
  writeActivityAsync,
} from '../src/modules/user-management/shared/activity-logger.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('activity-logger', () => {
  it('extracts x-forwarded-for first', () => {
    const req = {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
      ip: '127.0.0.1',
    };
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('falls back through req.ip and socket address', () => {
    expect(getClientIp({ ip: '10.0.0.1' })).toBe('10.0.0.1');
    expect(getClientIp({ socket: { remoteAddress: '10.0.0.2' } })).toBe('10.0.0.2');
    expect(getClientIp(null)).toBeNull();
  });

  it('writes an activity log entry', async () => {
    prisma.activityLog.create.mockResolvedValue({ id: 'log1' });
    const result = await writeActivity({
      actor: 'u1',
      module: 'users',
      action: 'updated',
      subject_type: 'User',
      subject_id: 'u2',
      description: 'Updated user profile',
      properties: { changed_fields: ['name'] },
      req: { ip: '10.0.0.1' },
    });

    expect(result.id).toBe('log1');
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actor_id: 'u1',
        module: 'users',
        action: 'updated',
        subject_type: 'User',
        subject_id: 'u2',
        description: 'Updated user profile',
        properties: { changed_fields: ['name'] },
        ip_address: '10.0.0.1',
      }),
    });
  });

  it('scrubs sensitive properties before persisting', async () => {
    prisma.activityLog.create.mockResolvedValue({ id: 'log2' });
    await writeActivity({
      actor: 'u1',
      module: 'auth',
      action: 'updated',
      description: 'Updated credentials',
      properties: {
        name: 'Alice',
        password: 'secret',
        resetToken: 'abc',
        nested: { apiSecret: 'shh' },
      },
    });

    const loggedProps = prisma.activityLog.create.mock.calls[0][0].data.properties;
    expect(loggedProps.name).toBe('Alice');
    expect(loggedProps.password).toBe('[REDACTED]');
    expect(loggedProps.resetToken).toBe('[REDACTED]');
    expect(loggedProps.nested.apiSecret).toBe('[REDACTED]');
  });

  it('never throws when Prisma fails', async () => {
    prisma.activityLog.create.mockRejectedValue(new Error('DB down'));
    const result = await writeActivity({
      actor: 'u1',
      module: 'users',
      action: 'view',
      description: 'Viewed user',
    });
    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Activity log write failed',
      expect.objectContaining({ error: 'DB down' }),
    );
  });

  it('writeActivityAsync does not throw and swallows DB errors', async () => {
    prisma.activityLog.create.mockRejectedValue(new Error('DB down'));
    await expect(
      writeActivityAsync({
        actor: 'u1',
        module: 'users',
        action: 'view',
        description: 'Viewed user',
      }),
    ).resolves.toBe(null);
  });
});
