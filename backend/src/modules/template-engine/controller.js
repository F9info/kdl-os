import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import * as service from './service.js';

// Project scope (req.projectId) is injected by the requireProject shared middleware
// (backend/src/middleware/project.js) on every route that reads X-Project-Id — see
// routes.js.  That middleware validates project existence (404) and caller access (403)
// against the projects module before this controller runs.

export const createRun = async (req, res, next) => {
  try {
    const projectId = req.projectId;
    const run = await service.createRun(projectId, req.user.id);
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'run_created',
      subject_type: 'TemplateEngineRun',
      subject_id: run.id,
      description: `Created template engine run for project ${projectId}`,
      properties: { projectId },
      ip_address: getClientIp(req),
    });
    return successResponse(res, run, 201);
  } catch (err) {
    next(err);
  }
};

export const listRuns = async (req, res, next) => {
  try {
    const projectId = req.projectId;
    const runs = await service.listRuns(projectId);
    return successResponse(res, runs);
  } catch (err) {
    next(err);
  }
};

export const getRun = async (req, res, next) => {
  try {
    const run = await service.getRun(req.validated.params.runId, req.projectId);
    return successResponse(res, run);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Crash-recovery: flip RUNNING → FAILED(INTERRUPTED) for a run.
export const resumeRun = async (req, res, next) => {
  try {
    await service.getRun(req.validated.params.runId, req.projectId); // 404 guard
    const count = await service.markInterruptedStages(req.validated.params.runId);
    return successResponse(res, { interrupted: count });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Stage advance. The approval stage requires :approve; the export stage requires :export (§9).
// All other gated stages require only :run (enforced at router level).
export const advanceStage = async (req, res, next) => {
  try {
    const { runId, stage } = req.validated.params;
    const projectId = req.projectId;

    // approval stage requires the extra :approve permission (§9).
    if (stage === 'approval') {
      const perms = req.userPermissions ?? (await resolvePermissions(req.user.id));
      if (!perms.bypass && !perms.permissions.includes('template-engine:approve')) {
        return errorResponse(res, 'Forbidden — template-engine:approve required for the approval stage', 403);
      }
    }

    // export stage requires :export permission (§3 row 9, §9).
    if (stage === 'export') {
      const perms = req.userPermissions ?? (await resolvePermissions(req.user.id));
      if (!perms.bypass && !perms.permissions.includes('template-engine:export')) {
        return errorResponse(res, 'Forbidden — template-engine:export required for the export stage', 403);
      }
    }

    const stageRecord = await service.advanceStage(runId, stage, req.user.id, projectId);

    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'stage_advanced',
      subject_type: 'TemplateEngineStage',
      subject_id: stageRecord.id,
      description: `Advanced stage ${stage} → ${stageRecord.status}`,
      properties: { runId, stage, status: stageRecord.status, errorCode: stageRecord.errorCode },
      ip_address: getClientIp(req),
    });

    return successResponse(res, stageRecord);
  } catch (err) {
    if (err.status === 409) {
      return errorResponse(res, err.message, 409, {
        code: err.code,
        blockingReason: err.blockingReason ?? null,
      });
    }
    if (err.status === 503) {
      return errorResponse(res, err.code ?? 'UPSTREAM_NOT_BUILT', 503, { code: err.code });
    }
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const getExport = async (req, res, next) => {
  try {
    const manifest = await service.getExportManifest(req.validated.params.runId, req.projectId);
    return successResponse(res, manifest);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, { code: err.code });
    next(err);
  }
};

export const retryStage = async (req, res, next) => {
  try {
    const { runId, stage } = req.validated.params;
    const stageRecord = await service.retryStage(runId, stage, req.user.id, req.projectId);
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'stage_retried',
      subject_type: 'TemplateEngineStage',
      subject_id: stageRecord.id,
      description: `Retried stage ${stage} → PENDING`,
      properties: { runId, stage },
      ip_address: getClientIp(req),
    });
    return successResponse(res, stageRecord);
  } catch (err) {
    if (err.status === 409) return errorResponse(res, err.message, 409, { code: err.code });
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const skipStage = async (req, res, next) => {
  try {
    const { runId, stage } = req.validated.params;
    const stageRecord = await service.skipStage(runId, stage, req.user.id, req.projectId);
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'stage_skipped',
      subject_type: 'TemplateEngineStage',
      subject_id: stageRecord.id,
      description: `Skipped stage ${stage} → SKIPPED`,
      properties: { runId, stage },
      ip_address: getClientIp(req),
    });
    return successResponse(res, stageRecord);
  } catch (err) {
    if (err.status === 409) return errorResponse(res, err.message, 409, { code: err.code });
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
