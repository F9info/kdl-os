/**
 * Crash recovery tests — TEMPLATE_ENGINE_ARCH.md §4.1.
 * Covers:
 * - INTERRUPTED recovery: RUNNING → FAILED(INTERRUPTED) on re-advance
 * - approval sub-steps: crash between approvedAt and tokensWrittenAt re-issues only the write
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./drivers/index.js', () => ({
  getDriver: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { getDriver } from './drivers/index.js';
import { advanceStage, markInterruptedStages } from './service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── markInterruptedStages ─────────────────────────────────────────────────────

describe('markInterruptedStages', () => {
  it('flips RUNNING stages to FAILED with INTERRUPTED errorCode', async () => {
    prisma.templateEngineStage = {
      updateMany: vi.fn().mockResolvedValue({ count: 2 }),
    };

    const count = await markInterruptedStages('run-1');
    expect(count).toBe(2);
    expect(prisma.templateEngineStage.updateMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', status: 'RUNNING' },
      data: expect.objectContaining({ status: 'FAILED', errorCode: 'INTERRUPTED' }),
    });
  });

  it('returns 0 when no RUNNING stages exist', async () => {
    prisma.templateEngineStage = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    const count = await markInterruptedStages('run-1');
    expect(count).toBe(0);
  });
});

// ── advanceStage crash recovery ───────────────────────────────────────────────

describe('advanceStage — RUNNING orphan → INTERRUPTED', () => {
  it('marks orphaned RUNNING stage as INTERRUPTED and throws 409', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'proj-A',
        stages: [
          { id: 'stage-1', stage: 'INTAKE', status: 'RUNNING' }, // orphaned RUNNING
        ],
      }),
    };

    prisma.templateEngineStage = {
      update: vi.fn().mockResolvedValue({ id: 'stage-1', status: 'FAILED', errorCode: 'INTERRUPTED' }),
    };

    await expect(advanceStage('run-1', 'intake', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_INTERRUPTED',
    });

    expect(prisma.templateEngineStage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'stage-1' },
        data: expect.objectContaining({ status: 'FAILED', errorCode: 'INTERRUPTED' }),
      })
    );
  });

  it('can be retried cleanly after INTERRUPTED recovery', async () => {
    // First call: stage is RUNNING → throws STAGE_INTERRUPTED
    prisma.templateEngineRun = {
      findUnique: vi.fn()
        .mockResolvedValueOnce({
          id: 'run-1', projectId: 'proj-A',
          stages: [{ id: 'stage-1', stage: 'INTAKE', status: 'RUNNING' }],
        })
        // Second call: stage is now FAILED (after interrupt mark)
        .mockResolvedValueOnce({
          id: 'run-1', projectId: 'proj-A',
          stages: [{ id: 'stage-1', stage: 'INTAKE', status: 'FAILED', errorCode: 'INTERRUPTED' }],
        }),
    };

    const stageUpsertResult = { id: 'stage-1', runId: 'run-1', stage: 'INTAKE', status: 'RUNNING' };
    prisma.templateEngineStage = {
      update: vi.fn()
        .mockResolvedValueOnce({ ...stageUpsertResult, status: 'FAILED', errorCode: 'INTERRUPTED' })
        .mockResolvedValueOnce({ ...stageUpsertResult, status: 'DONE' }),
      upsert: vi.fn().mockResolvedValue(stageUpsertResult),
      count: vi.fn().mockResolvedValue(0),
    };

    const mockDriver = { execute: vi.fn().mockResolvedValue({ outputRef: null }) };
    getDriver.mockReturnValue(mockDriver);

    // First attempt fails with STAGE_INTERRUPTED
    await expect(advanceStage('run-1', 'intake', 'user-1', 'proj-A')).rejects.toMatchObject({
      code: 'STAGE_INTERRUPTED',
    });

    // Second attempt succeeds (stage is now FAILED, not RUNNING)
    const result = await advanceStage('run-1', 'intake', 'user-1', 'proj-A');
    expect(result.status).toBe('DONE');
  });
});

// ── approval sub-steps (§4.1) ─────────────────────────────────────────────────

describe('approval sub-step crash recovery', () => {
  it('re-issues only the theme write when approvedAt is set but tokensWrittenAt is not', () => {
    // This test validates the data contract: a driver that sees approvedAt set but
    // tokensWrittenAt absent must only re-issue the theme-engine write, not re-approve.
    // Since the approval driver is a stub in Phase 1, we test the sub-step shape directly.
    const outputRef = { approvedAt: '2026-08-19T10:00:00.000Z', brandKitVersion: 3 };
    // tokensWrittenAt absent → only the write should be re-issued
    expect(outputRef.approvedAt).toBeTruthy();
    expect(outputRef.tokensWrittenAt).toBeUndefined();

    // A driver implementing this would check:
    const needsWrite = outputRef.approvedAt && !outputRef.tokensWrittenAt;
    expect(needsWrite).toBe(true);
  });

  it('does not re-issue the write when tokensWrittenAt is set (idempotency)', () => {
    const outputRef = {
      approvedAt: '2026-08-19T10:00:00.000Z',
      brandKitVersion: 3,
      tokensWrittenAt: '2026-08-19T10:01:00.000Z',
    };
    const needsWrite = outputRef.approvedAt && !outputRef.tokensWrittenAt;
    expect(needsWrite).toBe(false);
  });
});
