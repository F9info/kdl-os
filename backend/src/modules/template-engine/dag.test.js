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

// ── advanceStage stage 5 — guidelines completes (KDL-537) ────────────────────

describe('advanceStage stage 5 — guidelines completes (KDL-537)', () => {
  function runWithApprovalDone(extraStages = []) {
    return {
      id: 'run-1',
      projectId: 'proj-A',
      status: 'IN_PROGRESS',
      stages: [
        { stage: 'INTAKE',    status: 'DONE' },
        { stage: 'PALETTE',   status: 'DONE' },
        { stage: 'INFERENCE', status: 'DONE' },
        { stage: 'APPROVAL',  status: 'DONE', outputRef: { approvedAt: '2026-08-20T10:00:00Z', tokensWrittenAt: '2026-08-20T10:01:00Z' } },
        ...extraStages,
      ],
    };
  }

  it('transitions GUIDELINES to DONE when renderGuidelines succeeds', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(runWithApprovalDone()),
    };

    const stageUpsert = { id: 'stage-gl', runId: 'run-1', stage: 'GUIDELINES', status: 'RUNNING', outputRef: null };
    const stageDone   = { ...stageUpsert, status: 'DONE', outputRef: { renderId: 'brand-kit/guidelines/proj-A/out.pdf', renderedAt: '2026-08-20T10:02:00Z' } };
    prisma.templateEngineStage = {
      upsert: vi.fn().mockResolvedValue(stageUpsert),
      update: vi.fn().mockResolvedValue(stageDone),
    };

    const mockDriver = {
      execute: vi.fn().mockResolvedValue({
        outputRef: { renderId: 'brand-kit/guidelines/proj-A/out.pdf', renderedAt: '2026-08-20T10:02:00Z' },
      }),
    };
    getDriver.mockReturnValue(mockDriver);

    const result = await advanceStage('run-1', 'guidelines', 'user-1', 'proj-A');

    expect(mockDriver.execute).toHaveBeenCalledOnce();
    expect(prisma.templateEngineStage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DONE' }),
      }),
    );
    expect(result.outputRef.renderId).toBe('brand-kit/guidelines/proj-A/out.pdf');
  });

  it('crash recovery: driver returns prior outputRef when stageRecord.outputRef.renderId is set', async () => {
    // Simulate re-advance after INTERRUPTED cycle: stage is FAILED with prior outputRef stored.
    const priorOutputRef = { renderId: 'brand-kit/guidelines/proj-A/prior.pdf', renderedAt: '2026-08-20T09:00:00Z' };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(runWithApprovalDone([
        { stage: 'GUIDELINES', status: 'FAILED', outputRef: priorOutputRef },
      ])),
    };

    // Upsert re-activates the stage to RUNNING, preserving the prior outputRef.
    const stageUpsert = { id: 'stage-gl', runId: 'run-1', stage: 'GUIDELINES', status: 'RUNNING', outputRef: priorOutputRef };
    const stageDone   = { ...stageUpsert, status: 'DONE' };
    prisma.templateEngineStage = {
      upsert: vi.fn().mockResolvedValue(stageUpsert),
      update: vi.fn().mockResolvedValue(stageDone),
    };

    const mockDriver = {
      execute: vi.fn().mockResolvedValue({ outputRef: priorOutputRef }),
    };
    getDriver.mockReturnValue(mockDriver);

    const result = await advanceStage('run-1', 'guidelines', 'user-1', 'proj-A');
    expect(result.outputRef.renderId).toBe('brand-kit/guidelines/proj-A/prior.pdf');
  });
});

// ── Full 9-stage run reaches EXPORT (KDL-537) ────────────────────────────────

describe('full 9-stage run reaches EXPORT (KDL-537)', () => {
  const STAGE_ORDER = [
    'intake', 'palette', 'inference', 'approval',
    'guidelines', 'collateral', 'website',
    'preflight', 'export',
  ];

  it('all 9 stages advance to DONE in sequence', async () => {
    const stages = [];

    for (const stage of STAGE_ORDER) {
      prisma.templateEngineRun = {
        findUnique: vi.fn().mockResolvedValue({
          id: 'run-1',
          projectId: 'proj-A',
          status: 'IN_PROGRESS',
          stages: stages.map((s) => ({ ...s })),
        }),
      };

      const stageRec = { id: `stage-${stage}`, runId: 'run-1', stage: stage.toUpperCase(), status: 'RUNNING', outputRef: null };
      const stageDone = { ...stageRec, status: 'DONE', outputRef: { doneAt: '2026-08-20T10:00:00Z' } };
      prisma.templateEngineStage = {
        upsert: vi.fn().mockResolvedValue(stageRec),
        update: vi.fn().mockResolvedValue(stageDone),
      };

      getDriver.mockReturnValue({
        execute: vi.fn().mockResolvedValue({ outputRef: { doneAt: '2026-08-20T10:00:00Z' } }),
      });

      const result = await advanceStage('run-1', stage, 'user-1', 'proj-A');
      expect(result.outputRef).toBeTruthy();

      stages.push({ stage: stage.toUpperCase(), status: 'DONE', outputRef: { doneAt: '2026-08-20T10:00:00Z' } });
    }

    expect(stages).toHaveLength(9);
    expect(stages[stages.length - 1].stage).toBe('EXPORT');
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
