import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../auth/service.js', () => ({ hashPassword: vi.fn() }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
const { runExpirySweep } = await import('./core.js');

function fakeDb(subs) {
  const updates = [];
  return {
    updates,
    membershipSetting: { findMany: vi.fn().mockResolvedValue([{ key: 'general', value: { grace_days: 5 } }]) },
    membershipSubscription: {
      findMany: vi.fn().mockResolvedValue(subs),
      update: vi.fn(async ({ where, data }) => updates.push({ id: where.id, ...data })),
    },
    membershipEvent: { create: vi.fn() },
  };
}

describe('runExpirySweep', () => {
  const now = new Date('2026-06-10T00:00:00Z');
  it('ACTIVE past end -> PAST_DUE with the configured grace; PAST_DUE past grace -> EXPIRED', async () => {
    const db = fakeDb([
      { id: 'a', member_id: 'm1', status: 'ACTIVE', ends_at: new Date('2026-06-01T00:00:00Z') },
      { id: 'b', member_id: 'm2', status: 'PAST_DUE', grace_ends_at: new Date('2026-06-09T00:00:00Z') },
    ]);
    const r = await runExpirySweep({ now, db });
    expect(r).toMatchObject({ changed: 2, past_due: 1, expired: 1 });
    expect(db.updates[0]).toMatchObject({ id: 'a', status: 'PAST_DUE' });
    expect(db.updates[0].grace_ends_at.toISOString()).toBe('2026-06-06T00:00:00.000Z');
    expect(db.updates[1]).toMatchObject({ id: 'b', status: 'EXPIRED' });
    expect(db.membershipEvent.create).toHaveBeenCalledTimes(2);
  });
  it('does nothing when nothing is due', async () => {
    const db = fakeDb([]);
    expect(await runExpirySweep({ now, db })).toMatchObject({ changed: 0 });
    expect(db.updates).toEqual([]);
  });
});
