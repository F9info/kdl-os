import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/database.js', () => ({
  prisma: {
    activityLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from '../../src/config/database.js';
import { listActivity } from '../../src/modules/user-management/activity/service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('activity service — Step 3', () => {
  it('applies actor, module and date filters', async () => {
    prisma.activityLog.findMany.mockResolvedValue([{ id: 'l1', module: 'users' }]);
    prisma.activityLog.count.mockResolvedValue(1);

    const result = await listActivity({
      actor: 'u1',
      module: 'users',
      from: '2026-07-01',
      to: '2026-07-04',
    });

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actor_id: 'u1',
          module: expect.objectContaining({ contains: 'users' }),
          created_at: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      }),
    );
    expect(result.logs).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
  });

  it('paginates with defaults', async () => {
    prisma.activityLog.findMany.mockResolvedValue([]);
    prisma.activityLog.count.mockResolvedValue(0);

    const result = await listActivity({});
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });
});
