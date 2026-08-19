/**
 * DAG tests — TEMPLATE_ENGINE_ARCH.md §3.
 * Key assertion: one failed fan-out branch leaves its siblings intact.
 * Stages 5/6/7 fan out from approval and fan back into preflight.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./drivers/index.js', () => ({
  getDriver: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { getDriver } from './drivers/index.js';
import { advanceStage, checkGate } from './service.js';

// Builds a run snapshot with stages already completed up to approval.
function makeRun(extraStages = []) {
  const base = [
    { stage: 'INTAKE',    status: 'DONE' },
    { stage: 'PALETTE',   status: 'DONE' },
    { stage: 'INFERENCE', status: 'DONE' },
    { stage: 'APPROVAL',  status: 'DONE' },
  ];
  return {
    id: 'run-1',
    projectId: 'proj-A',
    status: 'IN_PROGRESS',
    stages: [...base, ...extraStages],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Fan-out independence ───────────────────────────────────────────────────────

describe('fan-out branch independence', () => {
  it('guidelines failing does NOT fail collateral gate', () => {
    const stages = [
      ...makeRun().stages,
      { stage: 'GUIDELINES', status: 'FAILED' },
    ];
    expect(checkGate('collateral', stages)).toMatchObject({ ok: true });
  });

  it('collateral failing does NOT fail website gate', () => {
    const stages = [
      ...makeRun().stages,
      { stage: 'COLLATERAL', status: 'FAILED' },
    ];
    expect(checkGate('website', stages)).toMatchObject({ ok: true });
  });

  it('website failing does NOT fail guidelines gate', () => {
    const stages = [
      ...makeRun().stages,
      { stage: 'WEBSITE', status: 'FAILED' },
    ];
    expect(checkGate('guidelines', stages)).toMatchObject({ ok: true });
  });

  it('preflight blocked only by non-terminal stage, not by sibling failure status', () => {
    // guidelines FAILED (not terminal) → preflight blocked
    // collateral DONE, website DONE → irrelevant to guidelines' check
    const stages = [
      ...makeRun().stages,
      { stage: 'GUIDELINES', status: 'FAILED' },
      { stage: 'COLLATERAL', status: 'DONE' },
      { stage: 'WEBSITE',    status: 'DONE' },
    ];
    const result = checkGate('preflight', stages);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('guidelines');
    expect(result.reason).not.toContain('collateral');
    expect(result.reason).not.toContain('website');
  });

  it('preflight passes when all three siblings are in terminal state (mix of DONE/SKIPPED)', () => {
    const stages = [
      ...makeRun().stages,
      { stage: 'GUIDELINES', status: 'DONE' },
      { stage: 'COLLATERAL', status: 'SKIPPED' },
      { stage: 'WEBSITE',    status: 'SKIPPED' },
    ];
    expect(checkGate('preflight', stages)).toMatchObject({ ok: true });
  });
});

// ── advanceStage — gate rejection 409 ────────────────────────────────────────

describe('advanceStage gate enforcement', () => {
  it('throws 409 STAGE_GATE_FAILED when palette gate fails', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'proj-A',
        stages: [{ stage: 'INTAKE', status: 'PENDING' }],
      }),
    };

    await expect(advanceStage('run-1', 'palette', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_GATE_FAILED',
    });
  });

  it('throws 409 STAGE_GATE_FAILED when preflight depends on non-terminal fan-out', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'proj-A',
        stages: [
          { stage: 'INTAKE',    status: 'DONE' },
          { stage: 'PALETTE',   status: 'DONE' },
          { stage: 'INFERENCE', status: 'DONE' },
          { stage: 'APPROVAL',  status: 'DONE' },
          { stage: 'GUIDELINES',status: 'DONE' },
          { stage: 'COLLATERAL',status: 'RUNNING' }, // not terminal
          { stage: 'WEBSITE',   status: 'DONE' },
        ],
      }),
    };

    await expect(advanceStage('run-1', 'preflight', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_GATE_FAILED',
    });
  });

  it('throws 404 when projectId does not match run (cross-project leakage guard)', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'proj-B',
        stages: [],
      }),
    };

    await expect(advanceStage('run-1', 'intake', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 404,
    });
  });
});

// ── advanceStage — driver throws UPSTREAM_NOT_BUILT ───────────────────────────

describe('advanceStage driver Phase 1', () => {
  it('records FAILED + UPSTREAM_NOT_BUILT when driver throws', async () => {
    const upstreamError = Object.assign(new Error('UPSTREAM_NOT_BUILT'), {
      code: 'UPSTREAM_NOT_BUILT',
      status: 503,
    });

    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-1',
        projectId: 'proj-A',
        stages: [{ stage: 'INTAKE', status: 'DONE' }],
      }),
    };

    const stageUpsertResult = { id: 'stage-1', runId: 'run-1', stage: 'PALETTE', status: 'RUNNING' };
    prisma.templateEngineStage = {
      upsert: vi.fn().mockResolvedValue(stageUpsertResult),
      update: vi.fn().mockResolvedValue({
        ...stageUpsertResult,
        status: 'FAILED',
        errorCode: 'UPSTREAM_NOT_BUILT',
      }),
    };

    const mockDriver = { execute: vi.fn().mockRejectedValue(upstreamError) };
    getDriver.mockReturnValue(mockDriver);

    await expect(advanceStage('run-1', 'palette', 'user-1', 'proj-A')).rejects.toMatchObject({
      code: 'UPSTREAM_NOT_BUILT',
      status: 503,
    });

    expect(prisma.templateEngineStage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          errorCode: 'UPSTREAM_NOT_BUILT',
        }),
      })
    );
  });
});
