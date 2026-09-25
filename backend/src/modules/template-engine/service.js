// TEMPLATE_ENGINE_ARCH.md §3 (DAG), §4 (data model), §4.1 (crash recovery), §5 (gating).
import { prisma } from '../../config/database.js';
import { getDriver } from './drivers/index.js';
import { enqueueSiteBuild } from './site/queue.js';
import { aiServicesConfigured, requestWebsiteCopy } from './ai-client.js';
import { withCreditHold } from '../credits/service.js';
import { WEBSITE_COPY_GENERATION_COST } from './costs.js';
import { buildGenerationTargets, applyGeneratedCopy } from './drivers/website-copy-generation.js';

// ── Enum helpers (avoids importing the Prisma enum at runtime) ────────────────

const STAGE_SLUG_TO_ENUM = {
  intake:     'INTAKE',
  palette:    'PALETTE',
  inference:  'INFERENCE',
  approval:   'APPROVAL',
  guidelines: 'GUIDELINES',
  collateral: 'COLLATERAL',
  website:    'WEBSITE',
  preflight:  'PREFLIGHT',
  export:     'EXPORT',
};

// Stages that may be skipped (optional fan-out branches per §3 DAG).
// Required stages (all others) cannot be skipped — only retried.
const OPTIONAL_STAGES = new Set(['GUIDELINES', 'COLLATERAL', 'WEBSITE']);

// Total number of stages in the DAG — used to detect run completion.
const TOTAL_STAGES = Object.keys(STAGE_SLUG_TO_ENUM).length;

// ── Gate logic (§3 Depends on column) ────────────────────────────────────────

function stageStatusMap(stages) {
  const m = {};
  for (const s of stages) m[s.stage] = s.status;
  return m;
}

const isDone     = (map, key) => map[key] === 'DONE';
const isTerminal = (map, key) => map[key] === 'DONE' || map[key] === 'SKIPPED';

// Returns { ok: true } or { ok: false, reason: string }.
export function checkGate(stageSlug, stages) {
  const map = stageStatusMap(stages);
  switch (stageSlug) {
    case 'intake':
      return { ok: true };
    case 'palette':
      if (!isDone(map, 'INTAKE'))
        return { ok: false, reason: 'Stage intake must be DONE before palette' };
      return { ok: true };
    case 'inference':
      if (!isDone(map, 'PALETTE'))
        return { ok: false, reason: 'Stage palette must be DONE before inference' };
      return { ok: true };
    case 'approval':
      if (!isDone(map, 'INFERENCE'))
        return { ok: false, reason: 'Stage inference must be DONE before approval' };
      return { ok: true };
    case 'guidelines':
      if (!isDone(map, 'APPROVAL'))
        return { ok: false, reason: 'Stage approval must be DONE before guidelines' };
      return { ok: true };
    case 'collateral':
      if (!isDone(map, 'APPROVAL'))
        return { ok: false, reason: 'Stage approval must be DONE before collateral' };
      return { ok: true };
    case 'website':
      if (!isDone(map, 'APPROVAL'))
        return { ok: false, reason: 'Stage approval must be DONE before website' };
      return { ok: true };
    case 'preflight':
      if (!isTerminal(map, 'GUIDELINES'))
        return { ok: false, reason: 'Stage guidelines must be DONE or SKIPPED before preflight' };
      if (!isTerminal(map, 'COLLATERAL'))
        return { ok: false, reason: 'Stage collateral must be DONE or SKIPPED before preflight' };
      if (!isTerminal(map, 'WEBSITE'))
        return { ok: false, reason: 'Stage website must be DONE or SKIPPED before preflight' };
      return { ok: true };
    case 'export':
      if (!isDone(map, 'PREFLIGHT'))
        return { ok: false, reason: 'Stage preflight must be DONE before export' };
      return { ok: true };
    default:
      return { ok: false, reason: `Unknown stage: ${stageSlug}` };
  }
}

// ── Run management ────────────────────────────────────────────────────────────

export async function createRun(projectId, userId) {
  return prisma.templateEngineRun.create({
    data: { projectId, createdBy: userId, status: 'IN_PROGRESS' },
    include: { stages: true },
  });
}

export async function listRuns(projectId) {
  return prisma.templateEngineRun.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: { stages: { orderBy: { stage: 'asc' } } },
  });
}

// Throws 404 if run not found or projectId mismatch (§10 — cross-project leakage guard).
export async function getRun(runId, projectId) {
  const run = await prisma.templateEngineRun.findUnique({
    where: { id: runId },
    include: { stages: { orderBy: { stage: 'asc' } } },
  });
  if (!run || run.projectId !== projectId) {
    const err = new Error('Run not found');
    err.status = 404;
    throw err;
  }
  return run;
}

// ── Crash recovery (§4.1) ─────────────────────────────────────────────────────

// Flip any RUNNING stage to FAILED(INTERRUPTED) for a given run.
// Call at resume time (e.g. on POST /runs/:runId/resume) or at advance time
// if we detect an orphaned RUNNING record.
export async function markInterruptedStages(runId) {
  const updated = await prisma.templateEngineStage.updateMany({
    where: { runId, status: 'RUNNING' },
    data: { status: 'FAILED', errorCode: 'INTERRUPTED', completedAt: new Date() },
  });
  return updated.count;
}

// ── Stage recovery ────────────────────────────────────────────────────────────

// Guard shared by retry and skip: a run that has already exported is immutable.
function assertNotExported(run) {
  const exportStage = run.stages.find((s) => s.stage === 'EXPORT');
  if (exportStage?.status === 'DONE') {
    const err = new Error('EXPORT_ALREADY_DONE');
    err.status = 409;
    err.code = 'EXPORT_ALREADY_DONE';
    throw err;
  }
}

// Reset a FAILED stage to PENDING so it can be re-advanced.
// Throws 409 EXPORT_ALREADY_DONE if the run has already exported.
// Throws 409 STAGE_NOT_FAILED if the stage is not in FAILED state.
export async function retryStage(runId, stageSlug, userId, projectId) {
  const run = await getRun(runId, projectId);
  assertNotExported(run);

  const stageEnum = STAGE_SLUG_TO_ENUM[stageSlug];
  const stage = run.stages.find((s) => s.stage === stageEnum);

  if (!stage || stage.status !== 'FAILED') {
    const err = new Error('STAGE_NOT_FAILED');
    err.status = 409;
    err.code = 'STAGE_NOT_FAILED';
    throw err;
  }

  return prisma.templateEngineStage.update({
    where: { id: stage.id },
    data: { status: 'PENDING', errorCode: null, startedAt: null, completedAt: null },
  });
}

// Move a FAILED optional stage to SKIPPED so the run can proceed to preflight.
// Throws 409 EXPORT_ALREADY_DONE if the run has already exported.
// Throws 409 STAGE_NOT_SKIPPABLE if the stage is a required stage.
// Throws 409 STAGE_NOT_FAILED if the stage is not in FAILED state.
export async function skipStage(runId, stageSlug, userId, projectId) {
  const run = await getRun(runId, projectId);
  assertNotExported(run);

  const stageEnum = STAGE_SLUG_TO_ENUM[stageSlug];

  if (!OPTIONAL_STAGES.has(stageEnum)) {
    const err = new Error('STAGE_NOT_SKIPPABLE');
    err.status = 409;
    err.code = 'STAGE_NOT_SKIPPABLE';
    throw err;
  }

  const stage = run.stages.find((s) => s.stage === stageEnum);

  if (!stage || stage.status !== 'FAILED') {
    const err = new Error('STAGE_NOT_FAILED');
    err.status = 409;
    err.code = 'STAGE_NOT_FAILED';
    throw err;
  }

  return prisma.templateEngineStage.update({
    where: { id: stage.id },
    data: { status: 'SKIPPED', errorCode: null, completedAt: new Date() },
  });
}

// ── AI copy generation ────────────────────────────────────────────────────────

// Explicit opt-in action on the WEBSITE stage — generates Hero/About body
// copy from intake data via ai-services, patching only blocks still at
// their static-seed default (see drivers/website-copy-generation.js). Never
// throws for AI/credit reasons: an unconfigured AI path, missing intake
// data, a transport failure, or an insufficient-credits refusal all resolve
// to `patchedBlocks: []` — the static seed text already on the page IS the
// fallback, nothing more to do.
export async function generateWebsiteCopy(runId, projectId, userId) {
  const run = await getRun(runId, projectId); // throws 404 on mismatch
  const stage = run.stages.find((s) => s.stage === 'WEBSITE');
  if (!stage || stage.status !== 'DONE') {
    const err = new Error('WEBSITE_NOT_ASSEMBLED');
    err.status = 409;
    err.code = 'WEBSITE_NOT_ASSEMBLED';
    throw err;
  }

  const homePageId = stage.outputRef?.pageKeyToId?.home;
  if (!homePageId) {
    const err = new Error('NO_HOME_PAGE');
    err.status = 409;
    err.code = 'NO_HOME_PAGE';
    throw err;
  }

  const page = await prisma.builderPage.findFirst({ where: { id: homePageId, deleted_at: null } });
  if (!page) return { patchedBlocks: [] };

  const targets = buildGenerationTargets(page.data);
  if (targets.length === 0) return { patchedBlocks: [] };

  const bizFields = await prisma.settingField.findMany({
    where: { slug: { in: ['brand-profile-company-name', 'brand-profile-business-description'] } },
  });
  const companyName = bizFields.find((f) => f.slug === 'brand-profile-company-name')?.value || 'Your Business';
  const businessDescription =
    bizFields.find((f) => f.slug === 'brand-profile-business-description')?.value || '';
  if (!businessDescription) return { patchedBlocks: [] };

  if (!aiServicesConfigured()) return { patchedBlocks: [] };

  let patchedBlocks = [];
  try {
    await withCreditHold(
      {
        projectId,
        actorId: userId,
        source: 'template-engine.website-copy',
        estimateMc: BigInt(WEBSITE_COPY_GENERATION_COST),
        idempotencyKey: undefined,
      },
      async () => {
        let envelope;
        try {
          envelope = await requestWebsiteCopy({ projectId, companyName, businessDescription });
        } catch {
          // Transport/auth failure talking to ai-services (AI_TRANSPORT/AI_AUTH)
          // — degrade silently, same posture as brand-kit's runInference.
          // Never billable: the hold settles at 0 µc, nothing was generated.
          return { result: null, actualMc: 0n, usage: null };
        }
        if (!envelope.success) {
          return { result: null, actualMc: 0n, usage: null };
        }
        const patchedData = applyGeneratedCopy(page.data, envelope.copy, targets);
        await prisma.builderPage.update({ where: { id: page.id }, data: { data: patchedData } });
        patchedBlocks = [...new Set(targets.map((t) => t.blockType))];
        return {
          result: null,
          actualMc: BigInt(WEBSITE_COPY_GENERATION_COST),
          usage: {
            provider: 'anthropic',
            model: envelope.model,
            inputTokens: envelope.usage?.input_tokens ?? 0,
            outputTokens: envelope.usage?.output_tokens ?? 0,
          },
        };
      },
    );
  } catch (creditErr) {
    if (creditErr.code !== 'INSUFFICIENT_CREDITS') throw creditErr;
  }

  return { patchedBlocks };
}

// ── Stage advance ─────────────────────────────────────────────────────────────

// Transitions a stage PENDING → RUNNING (after gate check), calls the driver,
// then transitions to DONE or FAILED. Returns the updated stage record.
//
// If the stage is already RUNNING (crash mid-run), marks it INTERRUPTED and
// throws so the caller can surface the recovery state before a clean retry.
//
// Throws:
//   409 STAGE_GATE_FAILED  — gate dependency not satisfied
//   409 STAGE_INTERRUPTED  — orphaned RUNNING stage recovered; re-advance to retry
//   503 UPSTREAM_NOT_BUILT — driver threw (Phase 1, always)
//   <driver code>          — any other named error from the driver
export async function advanceStage(runId, stageSlug, userId, projectId, options = {}) {
  const run = await getRun(runId, projectId); // throws 404 on mismatch

  const stageEnum = STAGE_SLUG_TO_ENUM[stageSlug];

  // Crash recovery: orphaned RUNNING stage → mark INTERRUPTED.
  const orphan = run.stages.find((s) => s.stage === stageEnum && s.status === 'RUNNING');
  if (orphan) {
    await prisma.templateEngineStage.update({
      where: { id: orphan.id },
      data: { status: 'FAILED', errorCode: 'INTERRUPTED', completedAt: new Date() },
    });
    const err = new Error('Stage was INTERRUPTED mid-run and has been marked FAILED. Re-advance to retry.');
    err.status = 409;
    err.code = 'STAGE_INTERRUPTED';
    throw err;
  }

  // Gate check (§5).
  const gate = checkGate(stageSlug, run.stages);
  if (!gate.ok) {
    const err = new Error(gate.reason);
    err.status = 409;
    err.code = 'STAGE_GATE_FAILED';
    err.blockingReason = gate.reason;
    throw err;
  }

  // Upsert stage record: PENDING → RUNNING.
  const stageRecord = await prisma.templateEngineStage.upsert({
    where: { runId_stage: { runId, stage: stageEnum } },
    create: { runId, stage: stageEnum, status: 'RUNNING', startedAt: new Date() },
    update: { status: 'RUNNING', startedAt: new Date(), errorCode: null, completedAt: null },
  });

  // Call driver. On any error: record errorCode (never the raw message), throw named error.
  const driver = getDriver(stageSlug);
  let updated;
  try {
    const result = await driver.execute({
      run,
      stageRecord,
      userId,
      projectId,
      templatePack: options.templatePack,
      navigationPages: options.navigationPages,
      layout: options.layout,
    });

    updated = await prisma.templateEngineStage.update({
      where: { id: stageRecord.id },
      data: {
        status: 'DONE',
        outputRef: result?.outputRef ?? null,
        completedAt: new Date(),
      },
    });
    if (stageEnum === 'WEBSITE') enqueueSiteBuild(run.projectId);
  } catch (driverErr) {
    // Never echo raw messages — only the named code (§10, §5).
    const errorCode = driverErr.code ?? 'DRIVER_ERROR';
    await prisma.templateEngineStage.update({
      where: { id: stageRecord.id },
      data: { status: 'FAILED', errorCode, completedAt: new Date() },
    });
    const err = new Error(errorCode);
    err.status = driverErr.status ?? 500;
    err.code = errorCode;
    throw err;
  }

  // Flip run to COMPLETED when every stage has reached a terminal state.
  const terminalCount = await prisma.templateEngineStage.count({
    where: { runId, status: { in: ['DONE', 'SKIPPED'] } },
  });
  if (terminalCount === TOTAL_STAGES) {
    await prisma.templateEngineRun.update({
      where: { id: runId },
      data: { status: 'COMPLETED' },
    });
    // Release theme-engine field locks so the editor becomes writable again.
    await prisma.settingField.updateMany({
      where: { locked_by: 'template-engine' },
      data: { locked_by: null },
    });
  }

  return updated;
}

// ── Export manifest (§6) ──────────────────────────────────────────────────────

export async function getExportManifest(runId, projectId) {
  const run = await getRun(runId, projectId);

  const preflightStage = run.stages.find((s) => s.stage === 'PREFLIGHT');
  if (preflightStage?.status !== 'DONE') {
    const err = new Error('PREFLIGHT_REQUIRED');
    err.status = 409;
    err.code = 'PREFLIGHT_REQUIRED';
    throw err;
  }

  const exportStage = run.stages.find((s) => s.stage === 'EXPORT');
  if (exportStage?.status !== 'DONE') {
    const err = new Error('EXPORT_NOT_DONE');
    err.status = 409;
    err.code = 'EXPORT_NOT_DONE';
    throw err;
  }

  const guidelinesRef = run.stages.find((s) => s.stage === 'GUIDELINES')?.outputRef ?? null;
  const collateralRef = run.stages.find((s) => s.stage === 'COLLATERAL')?.outputRef ?? null;
  const websiteRef    = run.stages.find((s) => s.stage === 'WEBSITE')?.outputRef ?? null;

  return {
    runId: run.id,
    projectId: run.projectId,
    brandKitVersion: run.brandKitVersion ?? null,
    site: {
      themeEndpoint: `/api/theme-engine/tokens?platform=webapp`,
      pageIds: websiteRef?.pageIds ?? [],
    },
    guidelines: guidelinesRef ?? null,
    collateral: collateralRef ?? null,
    exportedAt: exportStage.completedAt ?? new Date(),
  };
}

// ── Activity scope helper (§8.2 — disambiguates pre-rename history) ───────────

let _cutovers = null;

async function getCutover() {
  if (_cutovers !== null) return _cutovers;
  try {
    const row = await prisma.$queryRaw`
      SELECT finished_at FROM _prisma_migrations
      WHERE migration_name = '20260817000000_rename_template_engine_to_theme_engine'
      LIMIT 1
    `;
    _cutovers = row?.[0]?.finished_at ?? new Date('2026-08-17T00:00:00Z');
  } catch {
    _cutovers = new Date('2026-08-17T00:00:00Z');
  }
  return _cutovers;
}

// Use this filter whenever querying activity_logs with module = 'template-engine'
// to exclude legacy theme-engine history (§8.2).
export async function templateEngineActivityScope() {
  const cutover = await getCutover();
  return { module: 'template-engine', created_at: { gte: cutover } };
}
