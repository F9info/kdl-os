/**
 * Projects service — credit-seed on project creation (KDL-598).
 *
 * Verifies:
 *   (a) createProject seeds starter credits atomically inside the transaction.
 *   (b) createProject respects PROJECT_STARTER_CREDITS env var.
 *   (c) credit balance is > 0 after project creation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks must be hoisted before imports ──────────────────────────────────────
const { mockTx, mockPrisma } = vi.hoisted(() => {
  const mockTx = {
    project: {
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    creditBalance: {
      create: vi.fn(),
    },
    creditLedgerEntry: {
      create: vi.fn(),
    },
  };
  const mockPrisma = {
    project: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    appSetting: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (fn) => fn(mockTx)),
  };
  return { mockTx, mockPrisma };
});

vi.mock('../../config/database.js', () => ({ prisma: mockPrisma }));

import * as service from './service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT = { id: 'proj-1', name: 'Test', slug: 'test', is_default: false };

function setupNewProject() {
  mockPrisma.project.findUnique.mockResolvedValue(null); // no slug conflict
  mockTx.project.create.mockResolvedValue(PROJECT);
  mockTx.creditBalance.create.mockResolvedValue({});
  mockTx.creditLedgerEntry.create.mockResolvedValue({});
}

// ─── (a) seed credits in same transaction ─────────────────────────────────────

describe('(a) createProject seeds starter credits inside the transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNewProject();
    // No app setting → default 10 credits (10_000_000 µc)
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);
    delete process.env.PROJECT_STARTER_CREDITS;
  });

  afterEach(() => {
    delete process.env.PROJECT_STARTER_CREDITS;
  });

  it('creates creditBalance row with non-zero balance inside tx', async () => {
    const proj = await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    expect(proj.id).toBe('proj-1');
    expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
      data: { project_id: 'proj-1', balance_mc: 10_000_000n },
    });
  });

  it('creates GRANT ledger entry inside tx', async () => {
    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    expect(mockTx.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        project_id: 'proj-1',
        entry_type: 'GRANT',
        amount_mc: 10_000_000n,
        balance_after_mc: 10_000_000n,
        source: 'system',
        reason: 'new_project_seed',
      }),
    });
  });

  it('balance_mc equals amount_mc (correct balance_after_mc)', async () => {
    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    const call = mockTx.creditLedgerEntry.create.mock.calls[0][0];
    expect(call.data.balance_after_mc).toBe(call.data.amount_mc);
  });
});

// ─── (b) PROJECT_STARTER_CREDITS env var ──────────────────────────────────────

describe('(b) PROJECT_STARTER_CREDITS env var takes priority over app setting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNewProject();
  });

  afterEach(() => {
    delete process.env.PROJECT_STARTER_CREDITS;
  });

  it('uses env var when set', async () => {
    process.env.PROJECT_STARTER_CREDITS = '5000000'; // 5 credits
    mockPrisma.appSetting.findUnique.mockResolvedValue({ value: '999999999' }); // should be ignored

    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
      data: { project_id: 'proj-1', balance_mc: 5_000_000n },
    });
  });

  it('falls back to app setting when env var absent', async () => {
    delete process.env.PROJECT_STARTER_CREDITS;
    mockPrisma.appSetting.findUnique.mockResolvedValue({ key: 'credits.new_project_seed_mc', value: '20000000' });

    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
      data: { project_id: 'proj-1', balance_mc: 20_000_000n },
    });
  });

  it('falls back to 10 credits default when env and setting absent', async () => {
    delete process.env.PROJECT_STARTER_CREDITS;
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);

    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    expect(mockTx.creditBalance.create).toHaveBeenCalledWith({
      data: { project_id: 'proj-1', balance_mc: 10_000_000n },
    });
  });
});

// ─── (c) balance is positive ──────────────────────────────────────────────────

describe('(c) balance > 0 after createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNewProject();
    mockPrisma.appSetting.findUnique.mockResolvedValue(null);
    delete process.env.PROJECT_STARTER_CREDITS;
  });

  it('creditBalance.create is called with balance_mc > 0', async () => {
    await service.createProject({ name: 'Test', slug: 'test', actorId: 'user-1' });

    const call = mockTx.creditBalance.create.mock.calls[0][0];
    expect(call.data.balance_mc > 0n).toBe(true);
  });
});
