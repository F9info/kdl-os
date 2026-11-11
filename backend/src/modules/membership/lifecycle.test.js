import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../auth/service.js', () => ({ hashPassword: vi.fn() }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
const { signupOutcome, sweepDecisions, canTransition } = await import('./domain.js');
const { runExpirySweep, withApprovalDefault } = await import('./core.js');

describe('trials', () => {
  it('a paid plan with trial days starts TRIALING without payment; manual plans wait for approval first', () => {
    expect(signupOutcome({ is_free: false, trial_days: 14, approval_mode: 'AUTO' })).toEqual({ status: 'TRIALING', next: 'active' });
    expect(signupOutcome({ is_free: false, trial_days: 14, approval_mode: 'MANUAL' }).status).toBe('PENDING_APPROVAL');
    expect(signupOutcome({ is_free: false, trial_days: 0 }).status).toBe('PENDING_PAYMENT');
    expect(canTransition('PENDING_PAYMENT', 'TRIALING')).toBe(true);
  });
  it('an unpaid trial expires at its end with no grace period', () => {
    const now = new Date('2026-06-10T00:00:00Z');
    const d = sweepDecisions([{ id: 't', status: 'TRIALING', ends_at: new Date('2026-06-09T00:00:00Z') }, { id: 'u', status: 'TRIALING', ends_at: new Date('2026-06-20T00:00:00Z') }], now);
    expect(d).toEqual([{ id: 't', from: 'TRIALING', to: 'EXPIRED', data: {} }]);
  });
});

describe('require_approval_default', () => {
  it('turns an AUTO plan into MANUAL', async () => {
    const db = (v) => ({ membershipSetting: { findMany: async () => [{ key: 'signup', value: { require_approval_default: v } }] } });
    expect((await withApprovalDefault({ approval_mode: 'AUTO' }, db(true))).approval_mode).toBe('MANUAL');
    expect((await withApprovalDefault({ approval_mode: 'AUTO' }, db(false))).approval_mode).toBe('AUTO');
  });
});

describe('downgrade to a free plan at renewal', () => {
  it('moves the member to the free plan instead of PAST_DUE', async () => {
    const created = [];
    const updates = [];
    const db = {
      membershipSetting: { findMany: async () => [] },
      membershipSubscription: {
        findMany: async () => [{ id: 's1', member_id: 'm1', status: 'ACTIVE', ends_at: new Date('2026-06-01'), pending_plan_id: 'free', plan: { id: 'gold', slug: 'gold', is_free: false } }],
        update: async (a) => updates.push(a),
        create: async (a) => created.push(a),
      },
      membershipPlan: { findUnique: async () => ({ id: 'free', slug: 'free', name: 'Free', is_free: true }) },
      membershipEvent: { create: vi.fn() },
    };
    const r = await runExpirySweep({ now: new Date('2026-06-10'), db });
    expect(r.downgraded).toBe(1);
    expect(updates[0].data).toMatchObject({ status: 'EXPIRED', pending_plan_id: null });
    expect(created[0].data).toMatchObject({ plan_id: 'free', status: 'ACTIVE', ends_at: null });
  });
});
