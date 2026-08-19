import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import * as service from './service.js';

// Read project scope from header — X-Project-Id (TEMPLATE_ENGINE_ARCH §9, §10).
// projects module not yet built; we read the header directly.
function requireProjectId(req) {
  const projectId = req.headers['x-project-id'];
  if (!projectId) {
    const err = new Error('X-Project-Id header is required');
    err.status = 400;
    throw err;
  }
  return projectId;
}

export const createRun = async (req, res, next) => {
  try {
    const projectId = req.validated.body.projectId;
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
    const projectId = req.validated.query.projectId;
    const runs = await service.listRuns(projectId);
    return successResponse(res, { runs });
  } catch (err) {
    next(err);
  }
};

export const getRun = async (req, res, next) => {
  try {
    const projectId = requireProjectId(req);
    const run = await service.getRun(req.validated.params.runId, projectId);
    return successResponse(res, run);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Crash-recovery: flip RUNNING → FAILED(INTERRUPTED) for a run.
export const resumeRun = async (req, res, next) => {
  try {
    const projectId = requireProjectId(req);
    await service.getRun(req.validated.params.runId, projectId); // 404 guard
    const count = await service.markInterruptedStages(req.validated.params.runId);
    return successResponse(res, { interrupted: count });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Stage advance. The approval stage requires template-engine:approve in addition to :run.
// All other gated stages require only :run. :export is enforced on the export endpoint.
export const advanceStage = async (req, res, next) => {
  try {
    const projectId = requireProjectId(req);
    const { runId, stage } = req.validated.params;

    // approval stage requires the extra :approve permission (§9).
    if (stage === 'approval') {
      const perms = req.userPermissions ?? (await resolvePermissions(req.user.id));
      if (!perms.bypass && !perms.permissions.includes('template-engine:approve')) {
        return errorResponse(res, 'Forbidden — template-engine:approve required for the approval stage', 403);
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
    const projectId = requireProjectId(req);
    const manifest = await service.getExportManifest(req.validated.params.runId, projectId);
    return successResponse(res, manifest);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, { code: err.code });
    next(err);
  }
};
