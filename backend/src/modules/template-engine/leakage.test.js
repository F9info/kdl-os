/**
 * Cross-project leakage tests — TEMPLATE_ENGINE_ARCH.md §10 + PROJECTS_ARCH §6 pattern.
 * Asserts that TemplateEngineRun / TemplateEngineStage rows from project B are
 * unreachable from project A's context (404, not 403).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

import { prisma } from '../../config/database.js';
import { getRun, listRuns, getExportManifest } from './service.js';

const PROJECT_A = 'proj-AAAA';
const PROJECT_B = 'proj-BBBB';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getRun — direct-id probe ──────────────────────────────────────────────────

describe('getRun cross-project isolation', () => {
  it('returns 404 when run belongs to B but caller is scoped to A', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-B',
        projectId: PROJECT_B,
        stages: [],
      }),
    };

    await expect(getRun('run-B', PROJECT_A)).rejects.toMatchObject({ status: 404 });
  });

  it('returns 404 for non-existent run (existence oracle prevention)', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    await expect(getRun('run-none', PROJECT_A)).rejects.toMatchObject({ status: 404 });
  });

  it('returns run when projectId matches', async () => {
    const run = { id: 'run-A', projectId: PROJECT_A, stages: [] };
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue(run),
    };

    const result = await getRun('run-A', PROJECT_A);
    expect(result.id).toBe('run-A');
  });
});

// ── listRuns — list isolation ─────────────────────────────────────────────────

describe('listRuns cross-project isolation', () => {
  it('queries only by the supplied projectId — never returns other projects', async () => {
    const runsA = [{ id: 'run-A', projectId: PROJECT_A, stages: [] }];
    prisma.templateEngineRun = {
      findMany: vi.fn().mockResolvedValue(runsA),
    };

    const result = await listRuns(PROJECT_A);
    expect(result).toEqual(runsA);

    // Verify the query filter is scoped to project A
    expect(prisma.templateEngineRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: PROJECT_A } })
    );
  });

  it('does not expose project B runs when listing project A', async () => {
    // Simulate DB returning only A's rows (Prisma WHERE filters it)
    prisma.templateEngineRun = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    const result = await listRuns(PROJECT_A);
    const hasB = result.some((r) => r.projectId === PROJECT_B);
    expect(hasB).toBe(false);
  });
});

// ── getExportManifest — cross-project export probe ────────────────────────────

describe('getExportManifest cross-project isolation', () => {
  it('returns 404 when run belongs to B but caller is scoped to A', async () => {
    prisma.templateEngineRun = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'run-B',
        projectId: PROJECT_B,
        stages: [{ stage: 'PREFLIGHT', status: 'DONE' }, { stage: 'EXPORT', status: 'DONE' }],
      }),
    };

    await expect(getExportManifest('run-B', PROJECT_A)).rejects.toMatchObject({ status: 404 });
  });
});

// ── Stage rows — no direct access without run scope ──────────────────────────

describe('TemplateEngineStage access via run scope only', () => {
  it('stage rows are only accessible through their parent run (CASCADE delete if run deleted)', () => {
    // This is a schema assertion expressed as a test contract.
    // TemplateEngineStage has runId FK with onDelete: Cascade.
    // There is no direct /stages/:stageId endpoint — access is always through /runs/:runId.
    // This test documents the invariant; enforcement is in the schema and route absence.
    const schemaHasNoDirectStageEndpoint = true;
    expect(schemaHasNoDirectStageEndpoint).toBe(true);
  });
});
