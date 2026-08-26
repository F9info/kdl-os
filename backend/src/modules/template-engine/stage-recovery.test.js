/**
 * Stage recovery tests — KDL-580.
 * Covers: retryStage, skipStage, and all guard conditions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('./drivers/index.js', () => ({ getDriver: vi.fn() }));

import { prisma } from '../../config/database.js';
import { retryStage, skipStage } from './service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRun(stages) {
  return {
    id: 'run-1',
    projectId: 'proj-A',
    stages,
  };
}

function stage(stageEnum, status, id = `stage-${stageEnum}`) {
  return { id, stage: stageEnum, status };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── retryStage ────────────────────────────────────────────────────────────────

describe('retryStage', () => {
  it('resets a FAILED stage to PENDING', async () => {
    const failedStage = stage('GUIDELINES', 'FAILED');
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('INTAKE', 'DONE'),
        stage('APPROVAL', 'DONE'),
        failedStage,
      ])),
    };
    prisma.templateEngineStage = {
      update: vi.fn().mockResolvedValue({ ...failedStage, status: 'PENDING', errorCode: null }),
    };

    const result = await retryStage('run-1', 'guidelines', 'user-1', 'proj-A');

    expect(result.status).toBe('PENDING');
    expect(prisma.templateEngineStage.update).toHaveBeenCalledWith({
      where: { id: failedStage.id },
      data: { status: 'PENDING', errorCode: null, startedAt: null, completedAt: null },
    });
  });

  it('throws STAGE_NOT_FAILED when stage is DONE', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('GUIDELINES', 'DONE'),
      ])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws STAGE_NOT_FAILED when stage has not started (no record)', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws EXPORT_ALREADY_DONE when the run has already exported', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('EXPORT', 'DONE'),
        stage('GUIDELINES', 'FAILED'),
      ])),
    };

    await expect(retryStage('run-1', 'guidelines', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'EXPORT_ALREADY_DONE',
    });
  });

  it('works for required stages (intake, preflight, etc.) — required ≠ non-retryable', async () => {
    const failedIntake = stage('INTAKE', 'FAILED');
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([failedIntake])),
    };
    prisma.templateEngineStage = {
      update: vi.fn().mockResolvedValue({ ...failedIntake, status: 'PENDING', errorCode: null }),
    };

    const result = await retryStage('run-1', 'intake', 'user-1', 'proj-A');
    expect(result.status).toBe('PENDING');
  });
});

// ── skipStage ─────────────────────────────────────────────────────────────────

describe('skipStage', () => {
  for (const slug of ['guidelines', 'collateral', 'website']) {
    const stageEnum = slug.toUpperCase();

    it(`skips a FAILED ${slug} stage to SKIPPED`, async () => {
      const failedStage = stage(stageEnum, 'FAILED');
      prisma.templateEngineRun = {
        findUnique: vi.fn().mockResolvedValue(makeRun([
          stage('APPROVAL', 'DONE'),
          failedStage,
        ])),
      };
      prisma.templateEngineStage = {
        update: vi.fn().mockResolvedValue({ ...failedStage, status: 'SKIPPED', errorCode: null }),
      };

      const result = await skipStage('run-1', slug, 'user-1', 'proj-A');

      expect(result.status).toBe('SKIPPED');
      expect(prisma.templateEngineStage.update).toHaveBeenCalledWith({
        where: { id: failedStage.id },
        data: expect.objectContaining({ status: 'SKIPPED', errorCode: null }),
      });
    });
  }

  for (const slug of ['intake', 'palette', 'inference', 'approval', 'preflight', 'export']) {
    it(`rejects skip on required stage: ${slug}`, async () => {
      prisma.templateEngineRun = {
        findUnique: vi.fn().mockResolvedValue(makeRun([
          stage(slug.toUpperCase(), 'FAILED'),
        ])),
      };

      await expect(skipStage('run-1', slug, 'user-1', 'proj-A')).rejects.toMatchObject({
        status: 409,
        code: 'STAGE_NOT_SKIPPABLE',
      });
    });
  }

  it('throws STAGE_NOT_FAILED when optional stage is not FAILED', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('COLLATERAL', 'PENDING'),
      ])),
    };

    await expect(skipStage('run-1', 'collateral', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'STAGE_NOT_FAILED',
    });
  });

  it('throws EXPORT_ALREADY_DONE when the run has already exported', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(makeRun([
        stage('EXPORT', 'DONE'),
        stage('COLLATERAL', 'FAILED'),
      ])),
    };

    await expect(skipStage('run-1', 'collateral', 'user-1', 'proj-A')).rejects.toMatchObject({
      status: 409,
      code: 'EXPORT_ALREADY_DONE',
    });
  });

  it('a skipped optional stage allows preflight gate to pass (integration with checkGate)', async () => {
    // After skipping collateral, the gate for preflight should accept SKIPPED.
    // This tests the data contract, not a DB call — checkGate is a pure function.
    const { checkGate } = await import('./service.js');
    const stagesAfterSkip = [
      stage('INTAKE', 'DONE'),
      stage('PALETTE', 'DONE'),
      stage('INFERENCE', 'DONE'),
      stage('APPROVAL', 'DONE'),
      stage('GUIDELINES', 'DONE'),
      stage('COLLATERAL', 'SKIPPED'),
      stage('WEBSITE', 'DONE'),
    ];
    expect(checkGate('preflight', stagesAfterSkip)).toMatchObject({ ok: true });
  });
});
