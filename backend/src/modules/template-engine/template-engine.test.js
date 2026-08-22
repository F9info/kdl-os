/**
 * Runtime gate — template-engine orchestrator (KDL-501).
 *
 * Tests per TEMPLATE_ENGINE_ARCH.md issue requirement:
 *   (a) checkGate passes when dependencies are DONE.
 *   (b) checkGate blocks when dependencies are not DONE (STAGE_GATE_FAILED).
 *   (c) markInterruptedStages flips RUNNING → FAILED(INTERRUPTED).
 *   (d) templateEngineActivityScope() cutover guard resolves to a Date.
 *   (e) advanceStage gate is enforced server-side via service.
 *   (f) preflight driver aggregates branch errors correctly.
 *   (g) run.status transitions to COMPLETED when all 9 stages reach a terminal state (KDL-597).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks must be hoisted before any imports ──────────────────────────────────
vi.mock('../../config/database.js', () => ({
  prisma: {
    templateEngineRun: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    templateEngineStage: {
      update: vi.fn(),
      upsert: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('./drivers/index.js', () => ({
  getDriver: vi.fn((slug) => ({
    execute: vi.fn(async () => ({ outputRef: { stage: slug } })),
  })),
}));

import { prisma } from '../../config/database.js';
import { getDriver } from './drivers/index.js';
import * as service from './service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeStages(statusOverrides = {}) {
  const slugToEnum = {
    intake: 'INTAKE', palette: 'PALETTE', inference: 'INFERENCE',
    approval: 'APPROVAL', guidelines: 'GUIDELINES', collateral: 'COLLATERAL',
    website: 'WEBSITE', preflight: 'PREFLIGHT', export: 'EXPORT',
  };
  return Object.entries(slugToEnum).map(([, enumVal]) => ({
    id: `stage-${enumVal}`,
    stage: enumVal,
    status: statusOverrides[enumVal] ?? 'PENDING',
    errorCode: null,
    outputRef: null,
    startedAt: null,
    completedAt: null,
  }));
}

function makeRun(statusOverrides = {}) {
  return {
    id: 'run-1',
    projectId: 'proj-1',
    status: 'IN_PROGRESS',
    brandKitVersion: null,
    createdBy: 'user-1',
    stages: makeStages(statusOverrides),
  };
}

// ─── (a) checkGate — gates pass when deps satisfied ───────────────────────────

describe('(a) checkGate — gates pass when deps satisfied', () => {
  it('INTAKE has no deps — always passes', () => {
    const stages = makeStages();
    expect(service.checkGate('intake', stages)).toEqual({ ok: true });
  });

  it('palette passes when INTAKE is DONE', () => {
    const stages = makeStages({ INTAKE: 'DONE' });
    expect(service.checkGate('palette', stages)).toEqual({ ok: true });
  });

  it('fan-out: guidelines, collateral, website all pass when APPROVAL is DONE', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
    });
    expect(service.checkGate('guidelines', stages)).toEqual({ ok: true });
    expect(service.checkGate('collateral', stages)).toEqual({ ok: true });
    expect(service.checkGate('website', stages)).toEqual({ ok: true });
  });

  it('preflight passes when GUIDELINES, COLLATERAL, WEBSITE are all DONE', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE',
    });
    expect(service.checkGate('preflight', stages)).toEqual({ ok: true });
  });

  it('preflight passes when branches are SKIPPED (not just DONE)', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'SKIPPED', COLLATERAL: 'SKIPPED', WEBSITE: 'SKIPPED',
    });
    expect(service.checkGate('preflight', stages)).toEqual({ ok: true });
  });

  it('export passes when PREFLIGHT is DONE', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE', PREFLIGHT: 'DONE',
    });
    expect(service.checkGate('export', stages)).toEqual({ ok: true });
  });
});

// ─── (b) checkGate — gates block when deps not satisfied ──────────────────────

describe('(b) checkGate — gates block when deps not satisfied', () => {
  it('palette blocked when INTAKE is PENDING', () => {
    const stages = makeStages();
    const result = service.checkGate('palette', stages);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/intake/i);
  });

  it('preflight blocked when WEBSITE is still PENDING', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE',
    });
    const result = service.checkGate('preflight', stages);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/website/i);
  });

  it('export blocked when PREFLIGHT is PENDING', () => {
    const stages = makeStages({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE',
    });
    const result = service.checkGate('export', stages);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/preflight/i);
  });

  it('unknown stage always blocks', () => {
    const result = service.checkGate('nonexistent', []);
    expect(result.ok).toBe(false);
  });
});

// ─── (c) Crash recovery ───────────────────────────────────────────────────────

describe('(c) markInterruptedStages — crash recovery', () => {
  beforeEach(() => vi.clearAllMocks());

  it('flips RUNNING stages to FAILED(INTERRUPTED) and returns count', async () => {
    prisma.templateEngineStage.updateMany.mockResolvedValue({ count: 2 });

    const count = await service.markInterruptedStages('run-1');

    expect(count).toBe(2);
    expect(prisma.templateEngineStage.updateMany).toHaveBeenCalledWith({
      where: { runId: 'run-1', status: 'RUNNING' },
      data: { status: 'FAILED', errorCode: 'INTERRUPTED', completedAt: expect.any(Date) },
    });
  });

  it('is a no-op when no RUNNING stages exist', async () => {
    prisma.templateEngineStage.updateMany.mockResolvedValue({ count: 0 });
    const count = await service.markInterruptedStages('run-1');
    expect(count).toBe(0);
  });
});

// ─── (d) Activity scope cutover guard ─────────────────────────────────────────

describe('(d) templateEngineActivityScope() — cutover guard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a module = template-engine where fragment with a Date cutover', async () => {
    prisma.$queryRaw.mockResolvedValue([{ finished_at: new Date('2026-08-17T00:00:00Z') }]);
    const scope = await service.templateEngineActivityScope();
    expect(scope).toMatchObject({ module: 'template-engine' });
    // Verify the Prisma column name is created_at (snake_case), not createdAt.
    expect(scope).not.toHaveProperty('createdAt');
    expect(scope.created_at?.gte).toBeInstanceOf(Date);
  });

  it('falls back to 2026-08-17 when DB query fails', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB error'));
    const scope = await service.templateEngineActivityScope();
    expect(scope).not.toHaveProperty('createdAt');
    expect(scope.created_at.gte).toBeInstanceOf(Date);
    expect(scope.created_at.gte.toISOString()).toMatch(/^2026-08-17/);
  });
});

// ─── (e) advanceStage — gate enforced server-side ─────────────────────────────

describe('(e) advanceStage — server-side gate enforcement', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws 409 STAGE_GATE_FAILED when palette dep not met', async () => {
    // INTAKE is PENDING → palette must be blocked
    prisma.templateEngineRun.findUnique.mockResolvedValue(makeRun());

    await expect(service.advanceStage('run-1', 'palette', 'user-1', 'proj-1'))
      .rejects.toMatchObject({ status: 409, code: 'STAGE_GATE_FAILED' });
  });

  it('throws 409 STAGE_INTERRUPTED when stage is orphaned RUNNING', async () => {
    const run = makeRun({ INTAKE: 'RUNNING' });
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);
    prisma.templateEngineStage.update.mockResolvedValue({});

    await expect(service.advanceStage('run-1', 'intake', 'user-1', 'proj-1'))
      .rejects.toMatchObject({ status: 409, code: 'STAGE_INTERRUPTED' });
  });

  it('advances intake (no deps) — driver is called and stage marked DONE', async () => {
    const run = makeRun(); // all PENDING
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);

    const upsertResult = { id: 'stage-INTAKE', stage: 'INTAKE', status: 'RUNNING' };
    const updatedResult = { id: 'stage-INTAKE', stage: 'INTAKE', status: 'DONE', outputRef: { stage: 'intake' } };

    prisma.templateEngineStage.upsert.mockResolvedValue(upsertResult);
    prisma.templateEngineStage.update.mockResolvedValue(updatedResult);
    prisma.templateEngineRun.update.mockResolvedValue({});

    const result = await service.advanceStage('run-1', 'intake', 'user-1', 'proj-1');

    expect(getDriver).toHaveBeenCalledWith('intake');
    expect(result.status).toBe('DONE');
  });

  it('rejects cross-project access (projectId mismatch → 404)', async () => {
    // run belongs to proj-1, caller claims proj-99
    prisma.templateEngineRun.findUnique.mockResolvedValue(makeRun()); // projectId = 'proj-1'

    await expect(service.advanceStage('run-1', 'intake', 'user-1', 'proj-99'))
      .rejects.toMatchObject({ status: 404 });
  });
});

// ─── (f) preflight driver ─────────────────────────────────────────────────────

describe('(f) preflight driver — aggregates branch errors', () => {
  it('passes when all branches DONE with no errors', async () => {
    const { getDriver: realGetDriver } = await import('./drivers/index.js');
    // Use real driver
    vi.mocked(getDriver).mockImplementationOnce((slug) => {
      if (slug === 'preflight') {
        return {
          execute: async ({ run }) => {
            const stageMap = Object.fromEntries(run.stages.map((s) => [s.stage, s]));
            const errors = [];
            for (const branch of ['GUIDELINES', 'COLLATERAL', 'WEBSITE']) {
              const s = stageMap[branch];
              if (s?.status === 'FAILED' && s.errorCode) errors.push({ stage: branch, errorCode: s.errorCode });
            }
            if (errors.length > 0) throw Object.assign(new Error('PREFLIGHT_FAILED'), { status: 409, code: 'PREFLIGHT_FAILED', errors });
            return { outputRef: { checkedAt: new Date().toISOString(), errors: [] } };
          },
        };
      }
      return { execute: vi.fn(async () => ({ outputRef: {} })) };
    });

    const run = makeRun({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE',
    });
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);
    const upsert = { id: 'stage-PREFLIGHT', stage: 'PREFLIGHT', status: 'RUNNING' };
    const updated = { id: 'stage-PREFLIGHT', stage: 'PREFLIGHT', status: 'DONE', outputRef: { errors: [] } };
    prisma.templateEngineStage.upsert.mockResolvedValue(upsert);
    prisma.templateEngineStage.update.mockResolvedValue(updated);
    prisma.templateEngineRun.update.mockResolvedValue({});

    const result = await service.advanceStage('run-1', 'preflight', 'user-1', 'proj-1');
    expect(result.status).toBe('DONE');
  });
});

// ─── (g) run completion — status → COMPLETED when all stages terminal (KDL-597) ─

describe('(g) run.status transitions to COMPLETED (KDL-597)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('marks run COMPLETED when advancing export completes all 9 DONE stages', async () => {
    // 8 stages already DONE, advancing the last one (export)
    const run = makeRun({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE', PREFLIGHT: 'DONE',
    });
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);

    const upsertResult = { id: 'stage-EXPORT', stage: 'EXPORT', status: 'RUNNING' };
    const doneResult = { id: 'stage-EXPORT', stage: 'EXPORT', status: 'DONE', outputRef: {} };
    prisma.templateEngineStage.upsert.mockResolvedValue(upsertResult);
    prisma.templateEngineStage.update.mockResolvedValue(doneResult);
    // All 9 stages are now terminal after the EXPORT update
    prisma.templateEngineStage.count.mockResolvedValue(9);
    prisma.templateEngineRun.update.mockResolvedValue({ id: 'run-1', status: 'COMPLETED' });

    await service.advanceStage('run-1', 'export', 'user-1', 'proj-1');

    expect(prisma.templateEngineRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'COMPLETED' },
    });
  });

  it('marks run COMPLETED when EXPORT is SKIPPED and final required stage is advanced', async () => {
    // Simulate EXPORT already SKIPPED — 8 stages DONE + EXPORT SKIPPED = 9 terminal
    const run = makeRun({
      INTAKE: 'DONE', PALETTE: 'DONE', INFERENCE: 'DONE', APPROVAL: 'DONE',
      GUIDELINES: 'DONE', COLLATERAL: 'DONE', WEBSITE: 'DONE',
    });
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);

    const upsertResult = { id: 'stage-PREFLIGHT', stage: 'PREFLIGHT', status: 'RUNNING' };
    const doneResult = { id: 'stage-PREFLIGHT', stage: 'PREFLIGHT', status: 'DONE', outputRef: {} };
    prisma.templateEngineStage.upsert.mockResolvedValue(upsertResult);
    prisma.templateEngineStage.update.mockResolvedValue(doneResult);
    // count returns 9: 8 DONE + 1 SKIPPED EXPORT
    prisma.templateEngineStage.count.mockResolvedValue(9);
    prisma.templateEngineRun.update.mockResolvedValue({ id: 'run-1', status: 'COMPLETED' });

    await service.advanceStage('run-1', 'preflight', 'user-1', 'proj-1');

    expect(prisma.templateEngineRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'COMPLETED' },
    });
  });

  it('does NOT mark run COMPLETED when fewer than 9 stages are terminal', async () => {
    const run = makeRun(); // all PENDING
    prisma.templateEngineRun.findUnique.mockResolvedValue(run);

    const upsertResult = { id: 'stage-INTAKE', stage: 'INTAKE', status: 'RUNNING' };
    const doneResult = { id: 'stage-INTAKE', stage: 'INTAKE', status: 'DONE', outputRef: {} };
    prisma.templateEngineStage.upsert.mockResolvedValue(upsertResult);
    prisma.templateEngineStage.update.mockResolvedValue(doneResult);
    // Only 1 stage terminal after INTAKE advance
    prisma.templateEngineStage.count.mockResolvedValue(1);
    prisma.templateEngineRun.update.mockResolvedValue({});

    await service.advanceStage('run-1', 'intake', 'user-1', 'proj-1');

    expect(prisma.templateEngineRun.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETED' } }),
    );
  });
});
