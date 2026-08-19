import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks (vi.hoisted so factories run before module imports) ---

const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    $queryRaw: vi.fn(),
    creditLedgerEntry: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    creditHold: { create: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    creditBalance: { create: vi.fn(), update: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
  };
  const mockPrisma = {
    $transaction: vi.fn(async (fn, _opts) => fn(mockTx)),
    appSetting: { findUnique: vi.fn() },
    creditHold: { findUnique: vi.fn(), findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn() },
    creditBalance: { findUnique: vi.fn() },
    creditLedgerEntry: { findFirst: vi.fn(), findMany: vi.fn(), aggregate: vi.fn() },
    activityLog: { create: vi.fn() },
  };
  return { mockTx, mockPrisma };
});

vi.mock('../../config/database.js', () => ({ prisma: mockPrisma }));
vi.mock('../../shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));
vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
  writeActivity: vi.fn(),
  getClientIp: vi.fn(),
}));

import {
  usdToMc,
  CreditError,
  grantCredits,
  reserveCredits,
  settleHold,
  releaseHold,
  adjustCredits,
  forceReleaseHold,
  withCreditHold,
  getBalance,
  getLedger,
  getReconciliation,
} from './service.js';

// --- Helpers ---

function makeHold(overrides = {}) {
  return {
    id: 'hold_1',
    project_id: 'proj_1',
    amount_mc: 5_000_000n,
    status: 'PENDING',
    source: 'test',
    idempotency_key: 'key_1',
    expires_at: new Date(Date.now() + 900_000),
    ...overrides,
  };
}

function setupNoExpiredHolds() {
  mockTx.creditHold.findMany.mockResolvedValue([]);
}

function setupBalanceRow(balanceMc = 10_000_000n) {
  mockTx.$queryRaw.mockResolvedValue([{ id: 'bal_1', balance_mc: balanceMc }]);
}

function setupNoBalanceRow() {
  mockTx.$queryRaw.mockResolvedValue([]);
}

function setupEntryCreate(id = 'entry_1') {
  mockTx.creditLedgerEntry.create.mockResolvedValue({
    id,
    project_id: 'proj_1',
    entry_type: 'GRANT',
    amount_mc: 0n,
    balance_after_mc: 0n,
    hold_id: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.appSetting.findUnique.mockResolvedValue(null); // defaults
  mockPrisma.creditHold.count.mockResolvedValue(0);
  mockPrisma.creditHold.findMany.mockResolvedValue([]);
  mockPrisma.creditBalance.findUnique.mockResolvedValue(null);
  mockPrisma.creditLedgerEntry.findFirst.mockResolvedValue(null);
  mockPrisma.creditLedgerEntry.aggregate.mockResolvedValue({ _sum: { amount_mc: 0n } });
  mockTx.creditHold.findMany.mockResolvedValue([]);
  mockTx.creditHold.update.mockResolvedValue({});
  mockTx.creditBalance.update.mockResolvedValue({});
  mockTx.creditBalance.upsert.mockResolvedValue({});
  mockTx.creditLedgerEntry.findMany.mockResolvedValue([]);
});

// --- usdToMc ---

describe('usdToMc', () => {
  it('converts whole dollars', () => {
    expect(usdToMc('1')).toBe(1_000_000n);
  });

  it('converts fractional dollars', () => {
    expect(usdToMc('0.01')).toBe(10_000n);
  });

  it('handles sub-microcredit cost with minimum 1 µc', () => {
    expect(usdToMc('0.0000001')).toBe(1n);
  });

  it('returns 0n for null/undefined/empty', () => {
    expect(usdToMc(null)).toBe(0n);
    expect(usdToMc(undefined)).toBe(0n);
    expect(usdToMc('')).toBe(0n);
    expect(usdToMc('0')).toBe(0n);
  });

  it('handles numeric input', () => {
    expect(usdToMc(2)).toBe(2_000_000n);
  });
});

// --- grantCredits ---

describe('grantCredits', () => {
  it('inserts GRANT entry and upserts balance', async () => {
    setupNoBalanceRow();
    setupNoExpiredHolds();
    setupEntryCreate('entry_grant');
    mockTx.creditLedgerEntry.create.mockResolvedValue({
      id: 'entry_grant',
      hold_id: null,
      balance_after_mc: 10_000_000n,
    });

    const result = await grantCredits({
      projectId: 'proj_1',
      amountMc: 10_000_000n,
      source: 'admin.grant',
      reason: 'initial',
      actorId: 'user_1',
    });

    expect(result.entryId).toBe('entry_grant');
    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entry_type: 'GRANT', amount_mc: 10_000_000n }) }),
    );
    expect(mockTx.creditBalance.upsert).toHaveBeenCalled();
  });

  it('throws CreditError for zero amount', async () => {
    await expect(grantCredits({ projectId: 'proj_1', amountMc: 0n, source: 's', reason: 'r' })).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
  });

  it('throws CreditError for negative amount', async () => {
    await expect(grantCredits({ projectId: 'proj_1', amountMc: -1n, source: 's', reason: 'r' })).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
  });
});

// --- reserveCredits ---

describe('reserveCredits', () => {
  it('creates hold and RESERVE entry, returns holdId and expiresAt', async () => {
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    const hold = makeHold({ id: 'hold_new' });
    mockTx.creditHold.create.mockResolvedValue(hold);
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'entry_res', hold_id: 'hold_new', balance_after_mc: 5_000_000n });
    mockPrisma.creditHold.findUnique.mockResolvedValue(null); // no idempotency hit

    const result = await reserveCredits({
      projectId: 'proj_1',
      actorId: 'user_1',
      source: 'brand_kit.typography',
      estimateMc: 5_000_000n,
      idempotencyKey: 'key_new',
    });

    expect(result.holdId).toBe('hold_new');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockTx.creditHold.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amount_mc: 5_000_000n, status: 'PENDING' }) }),
    );
    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entry_type: 'RESERVE', amount_mc: -5_000_000n }) }),
    );
  });

  it('throws INSUFFICIENT_CREDITS (HTTP 402) when balance < estimate', async () => {
    setupBalanceRow(1_000_000n); // only 1 credit
    setupNoExpiredHolds();
    mockPrisma.creditHold.findUnique.mockResolvedValue(null);

    // $transaction needs to throw via the fn returning a requiredBalance > balance
    mockTx.creditHold.create.mockResolvedValue(makeHold());

    await expect(
      reserveCredits({ projectId: 'proj_1', estimateMc: 5_000_000n, source: 's', idempotencyKey: 'k1' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS', status: 402 });
  });

  it('returns existing hold on idempotency key replay (no double-charge)', async () => {
    const existingHold = makeHold({ id: 'hold_existing' });
    mockPrisma.creditHold.findUnique.mockResolvedValue(existingHold);

    const result = await reserveCredits({
      projectId: 'proj_1',
      estimateMc: 5_000_000n,
      source: 's',
      idempotencyKey: 'key_1',
    });

    expect(result.holdId).toBe('hold_existing');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// --- settleHold ---

describe('settleHold', () => {
  it('writes SETTLE entry with refund and marks hold SETTLED', async () => {
    const hold = makeHold({ amount_mc: 5_000_000n });
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    setupBalanceRow(0n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'entry_settle', hold_id: 'hold_1', balance_after_mc: 2_000_000n });

    const result = await settleHold({ holdId: 'hold_1', actualMc: 3_000_000n });

    expect(result.entryId).toBe('entry_settle');
    expect(result.overage).toBe(false);
    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entry_type: 'SETTLE',
          amount_mc: 2_000_000n, // 5M held - 3M actual = 2M refund
        }),
      }),
    );
    expect(mockTx.creditHold.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SETTLED' }) }),
    );
  });

  it('records overage when actual > held', async () => {
    const hold = makeHold({ amount_mc: 2_000_000n });
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    setupBalanceRow(0n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'entry_settle', hold_id: 'hold_1', balance_after_mc: -500_000n });

    const result = await settleHold({ holdId: 'hold_1', actualMc: 2_500_000n });

    expect(result.overage).toBe(true);
  });

  it('double-settle returns original entry idempotently', async () => {
    const hold = makeHold({ status: 'SETTLED' });
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    mockPrisma.creditLedgerEntry.findFirst.mockResolvedValue({ id: 'original_entry' });
    mockPrisma.creditBalance.findUnique.mockResolvedValue({ balance_mc: 5_000_000n });

    const result = await settleHold({ holdId: 'hold_1', actualMc: 3_000_000n });

    expect(result.entryId).toBe('original_entry');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('writes ADJUST entry for late settlement on EXPIRED hold', async () => {
    const hold = makeHold({ status: 'EXPIRED' });
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    setupBalanceRow(0n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'entry_late', hold_id: 'hold_1', balance_after_mc: -3_000_000n });

    const result = await settleHold({ holdId: 'hold_1', actualMc: 3_000_000n });

    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entry_type: 'ADJUST',
          reason: 'late_settlement',
          amount_mc: -3_000_000n,
        }),
      }),
    );
  });
});

// --- releaseHold ---

describe('releaseHold', () => {
  it('writes RELEASE entry and marks hold RELEASED', async () => {
    const hold = makeHold();
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    setupBalanceRow(0n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'entry_rel', hold_id: 'hold_1', balance_after_mc: 5_000_000n });

    const result = await releaseHold({ holdId: 'hold_1', reason: 'test' });

    expect(result.entryId).toBe('entry_rel');
    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entry_type: 'RELEASE', amount_mc: 5_000_000n }),
      }),
    );
  });

  it('is idempotent for already-released hold', async () => {
    const hold = makeHold({ status: 'RELEASED' });
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    mockPrisma.creditLedgerEntry.findFirst.mockResolvedValue({ id: 'original_release' });
    mockPrisma.creditBalance.findUnique.mockResolvedValue({ balance_mc: 10_000_000n });

    const result = await releaseHold({ holdId: 'hold_1' });

    expect(result.entryId).toBe('original_release');
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });
});

// --- Hold lifecycle: reserve → settle and reserve → release ---

describe('hold lifecycle', () => {
  it('reserve → settle succeeds end-to-end', async () => {
    // Step 1: reserve
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(null); // idempotency check
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    const hold = makeHold({ id: 'h1' });
    mockTx.creditHold.create.mockResolvedValue(hold);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_res', hold_id: 'h1', balance_after_mc: 5_000_000n });

    const { holdId } = await reserveCredits({ projectId: 'proj_1', estimateMc: 5_000_000n, source: 's', idempotencyKey: 'k1' });
    expect(holdId).toBe('h1');

    // Step 2: settle
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(hold);
    setupBalanceRow(5_000_000n);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_settle', hold_id: 'h1', balance_after_mc: 7_000_000n });

    const { overage } = await settleHold({ holdId, actualMc: 3_000_000n });
    expect(overage).toBe(false);
  });

  it('reserve → release succeeds end-to-end', async () => {
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(null);
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    const hold = makeHold({ id: 'h2' });
    mockTx.creditHold.create.mockResolvedValue(hold);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_res', hold_id: 'h2', balance_after_mc: 5_000_000n });

    const { holdId } = await reserveCredits({ projectId: 'proj_1', estimateMc: 5_000_000n, source: 's', idempotencyKey: 'k2' });

    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(hold);
    setupBalanceRow(5_000_000n);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_rel', hold_id: 'h2', balance_after_mc: 10_000_000n });

    const { entryId } = await releaseHold({ holdId, reason: 'failed' });
    expect(entryId).toBe('e_rel');
  });
});

// --- Expired hold reaping ---

describe('expired hold reaping', () => {
  it('reaps expired holds inside reserveCredits transaction before preflight check', async () => {
    const expiredHold = makeHold({
      id: 'h_expired',
      amount_mc: 4_000_000n,
      expires_at: new Date(Date.now() - 1000),
    });
    mockPrisma.creditHold.findUnique.mockResolvedValue(null); // no idempotency hit
    // Balance row shows 1M available (after 4M was held = 5M balance originally)
    setupBalanceRow(1_000_000n);
    // Expired holds returned during reap
    mockTx.creditHold.findMany.mockResolvedValueOnce([expiredHold]);
    // After reap, balance becomes 1M + 4M = 5M, enough for 3M reserve
    const newHold = makeHold({ id: 'h_new', amount_mc: 3_000_000n });
    mockTx.creditHold.create.mockResolvedValue(newHold);
    mockTx.creditLedgerEntry.create
      .mockResolvedValueOnce({ id: 'e_expire', hold_id: 'h_expired', balance_after_mc: 5_000_000n })
      .mockResolvedValueOnce({ id: 'e_res', hold_id: 'h_new', balance_after_mc: 2_000_000n });

    const result = await reserveCredits({
      projectId: 'proj_1',
      estimateMc: 3_000_000n,
      source: 's',
      idempotencyKey: 'k_new',
    });

    expect(result.holdId).toBe('h_new');
    // EXPIRE entry was created for the expired hold
    const expireCall = mockTx.creditLedgerEntry.create.mock.calls.find(
      (c) => c[0].data.entry_type === 'EXPIRE',
    );
    expect(expireCall).toBeTruthy();
    expect(expireCall[0].data.hold_id).toBe('h_expired');
  });
});

// --- Ledger arithmetic (reconciliation) ---

describe('getReconciliation', () => {
  it('reports match when ledger sum equals materialised balance', async () => {
    mockPrisma.creditBalance.findUnique.mockResolvedValue({ balance_mc: 7_000_000n });
    mockPrisma.creditLedgerEntry.aggregate.mockResolvedValue({ _sum: { amount_mc: 7_000_000n } });

    const result = await getReconciliation('proj_1');

    expect(result.match).toBe(true);
    expect(result.ledger_sum_mc).toBe(7_000_000n);
    expect(result.materialised_mc).toBe(7_000_000n);
  });

  it('reports mismatch on divergence', async () => {
    mockPrisma.creditBalance.findUnique.mockResolvedValue({ balance_mc: 7_000_000n });
    mockPrisma.creditLedgerEntry.aggregate.mockResolvedValue({ _sum: { amount_mc: 6_000_000n } });

    const result = await getReconciliation('proj_1');

    expect(result.match).toBe(false);
  });
});

// --- Cross-project isolation ---

describe('cross-project isolation', () => {
  it('grant on project A does not affect project B balance', async () => {
    setupNoBalanceRow();
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'e1', hold_id: null, balance_after_mc: 5_000_000n });

    await grantCredits({ projectId: 'proj_A', amountMc: 5_000_000n, source: 'seed', reason: 'init' });

    const upsertCalls = mockTx.creditBalance.upsert.mock.calls;
    expect(upsertCalls.every((c) => c[0].create.project_id === 'proj_A')).toBe(true);
  });

  it('reserve on project B with X-Project-Id boundary fails if balance is proj_A', async () => {
    mockPrisma.creditHold.findUnique.mockResolvedValue(null);
    // proj_B has no balance
    mockTx.$queryRaw.mockResolvedValue([]);
    mockTx.creditHold.findMany.mockResolvedValue([]);
    mockTx.creditHold.create.mockResolvedValue(makeHold({ project_id: 'proj_B' }));

    await expect(
      reserveCredits({ projectId: 'proj_B', estimateMc: 1_000_000n, source: 's', idempotencyKey: 'kb' }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_CREDITS' });
  });
});

// --- adjustCredits ---

describe('adjustCredits', () => {
  it('requires a reason', async () => {
    await expect(adjustCredits({ projectId: 'p', amountMc: 1n, source: 's', reason: '' })).rejects.toMatchObject({
      code: 'REASON_REQUIRED',
    });
  });

  it('rejects zero amount', async () => {
    await expect(adjustCredits({ projectId: 'p', amountMc: 0n, source: 's', reason: 'r' })).rejects.toMatchObject({
      code: 'INVALID_AMOUNT',
    });
  });

  it('writes ADJUST entry with signed amount', async () => {
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'e_adj', hold_id: null, balance_after_mc: 8_000_000n });

    const result = await adjustCredits({
      projectId: 'proj_1',
      amountMc: -2_000_000n,
      source: 'admin',
      reason: 'correction',
    });

    expect(result.entryId).toBe('e_adj');
    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ entry_type: 'ADJUST', amount_mc: -2_000_000n }) }),
    );
  });
});

// --- forceReleaseHold ---

describe('forceReleaseHold', () => {
  it('releases a PENDING hold', async () => {
    const hold = makeHold();
    mockPrisma.creditHold.findUnique.mockResolvedValue(hold);
    setupBalanceRow(0n);
    setupNoExpiredHolds();
    mockTx.creditLedgerEntry.create.mockResolvedValue({ id: 'e_frel', hold_id: 'hold_1', balance_after_mc: 5_000_000n });

    const result = await forceReleaseHold({ holdId: 'hold_1', actorId: 'admin_1' });
    expect(result.entryId).toBe('e_frel');
  });

  it('throws HOLD_NOT_PENDING for already-settled hold', async () => {
    mockPrisma.creditHold.findUnique.mockResolvedValue(makeHold({ status: 'SETTLED' }));
    await expect(forceReleaseHold({ holdId: 'hold_1' })).rejects.toMatchObject({ code: 'HOLD_NOT_PENDING' });
  });
});

// --- withCreditHold ---

describe('withCreditHold', () => {
  it('settles hold on fn success', async () => {
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(null); // reserve idempotency
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    const hold = makeHold({ id: 'h_wch' });
    mockTx.creditHold.create.mockResolvedValue(hold);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_res', hold_id: 'h_wch', balance_after_mc: 5_000_000n });

    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(hold); // settle lookup
    setupBalanceRow(5_000_000n);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_settle', hold_id: 'h_wch', balance_after_mc: 7_000_000n });

    const fn = vi.fn().mockResolvedValue({ result: 'done', actualMc: 3_000_000n, usage: null });

    const result = await withCreditHold(
      { projectId: 'proj_1', source: 's', estimateMc: 5_000_000n, idempotencyKey: 'k_wch' },
      fn,
    );

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('releases hold on fn error and re-throws', async () => {
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(null);
    setupBalanceRow(10_000_000n);
    setupNoExpiredHolds();
    const hold = makeHold({ id: 'h_err' });
    mockTx.creditHold.create.mockResolvedValue(hold);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_res', hold_id: 'h_err', balance_after_mc: 5_000_000n });

    // For releaseHold inside withCreditHold
    mockPrisma.creditHold.findUnique.mockResolvedValueOnce(hold);
    setupBalanceRow(5_000_000n);
    mockTx.creditLedgerEntry.create.mockResolvedValueOnce({ id: 'e_rel', hold_id: 'h_err', balance_after_mc: 10_000_000n });

    const fn = vi.fn().mockRejectedValue(new Error('AI call failed'));

    await expect(
      withCreditHold({ projectId: 'proj_1', source: 's', estimateMc: 5_000_000n, idempotencyKey: 'k_err' }, fn),
    ).rejects.toThrow('AI call failed');

    // releaseHold should have been called
    const releaseCalls = mockTx.creditLedgerEntry.create.mock.calls.filter(
      (c) => c[0].data.entry_type === 'RELEASE',
    );
    expect(releaseCalls.length).toBeGreaterThan(0);
  });
});

// --- getBalance ---

describe('getBalance', () => {
  it('returns balance_mc and open holds', async () => {
    mockPrisma.creditHold.count.mockResolvedValue(0);
    mockPrisma.creditBalance.findUnique.mockResolvedValue({ balance_mc: 8_000_000n });
    mockPrisma.creditHold.findMany.mockResolvedValue([makeHold()]);

    const result = await getBalance('proj_1');

    expect(result.balance_mc).toBe(8_000_000n);
    expect(result.open_holds).toHaveLength(1);
  });
});

// --- getLedger ---

describe('getLedger', () => {
  it('returns cursor-paginated entries', async () => {
    const entries = Array.from({ length: 21 }, (_, i) => ({ id: `e${i}`, project_id: 'proj_1' }));
    mockPrisma.creditLedgerEntry.findMany.mockResolvedValue(entries);

    const result = await getLedger('proj_1', { limit: 20 });

    expect(result.entries).toHaveLength(20);
    expect(result.next_cursor).toBe('e19');
  });

  it('returns null next_cursor when no more entries', async () => {
    mockPrisma.creditLedgerEntry.findMany.mockResolvedValue([{ id: 'e1' }]);

    const result = await getLedger('proj_1', { limit: 20 });

    expect(result.next_cursor).toBeNull();
  });
});
