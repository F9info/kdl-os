import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import * as service from './service.js';
import { z } from 'zod';
import { buildSite, siteExists } from './site/generator.js';
import { getStaticBuild, startStaticBuild, zipStaticBuild } from './site/static-build.js';
import { getIdentity } from '../identity/service.js';
import { compileTokens } from '../theme-engine/service.js';
import { prisma } from '../../config/database.js';

// Project scope (req.projectId) is injected by the requireProject shared middleware
// (backend/src/middleware/project.js) on every route that reads X-Project-Id — see
// routes.js.  That middleware validates project existence (404) and caller access (403)
// against the projects module before this controller runs.

// Creates (or refreshes) the project's generated Next.js app folder. After
// this, enqueueSiteBuild keeps it in sync with admin edits.
export const createSite = async (req, res, next) => {
  try {
    const result = await buildSite(req.projectId);
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'site_generated',
      subject_type: 'Project',
      subject_id: req.projectId,
      description: `Generated site folder "${result.slug}" (${result.pages} pages)`,
      properties: { projectId: req.projectId },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { slug: result.slug, pages: result.pages }, 201);
  } catch (err) {
    next(err);
  }
};

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

    const stageRecord = await service.advanceStage(runId, stage, req.user.id, projectId, {
      templatePack: req.validated.body?.templatePack,
      navigationPages: req.validated.body?.navigationPages,
      layout: req.validated.body?.layout,
    });

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

// One-click static export (needs the site folder from createSite first).
const apiBaseSchema = z.string().url().optional();

async function siteSlug(projectId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null } });
  return project && (await siteExists(project.slug)) ? project.slug : null;
}

export const startStatic = async (req, res, next) => {
  try {
    const parsed = apiBaseSchema.safeParse(req.body?.apiBase || undefined);
    if (!parsed.success) return errorResponse(res, 'apiBase must be a full URL', 422);
    const slug = await siteSlug(req.projectId);
    if (!slug) return errorResponse(res, 'Prepare the project folder first', 409);
    // The company's contact details travel into the build: a form on the static site shows them.
    const identity = await getIdentity();
    const contact = { email: identity.contact_email, phone: identity.contact_phone };
    // The site's theme is baked into the folder: a static site cannot ask a server for it later.
    const tokens = await compileTokens('webapp', undefined, undefined, req.projectId);
    if (!startStaticBuild(slug, { apiBase: parsed.data, contact, tokens: { css: tokens.css, activeTheme: tokens.activeTheme } }))
      return errorResponse(res, 'A build is already running', 409);
    return successResponse(res, getStaticBuild(slug), 202);
  } catch (err) {
    next(err);
  }
};

export const staticStatus = async (req, res, next) => {
  try {
    const slug = await siteSlug(req.projectId);
    return successResponse(res, slug ? getStaticBuild(slug) : { state: 'idle', log: '' });
  } catch (err) {
    next(err);
  }
};

export const staticDownload = async (req, res, next) => {
  try {
    const slug = await siteSlug(req.projectId);
    const buf = slug ? zipStaticBuild(slug) : null;
    if (!buf) return errorResponse(res, 'No finished static build', 404);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-static.zip"`);
    return res.end(buf);
  } catch (err) {
    next(err);
  }
};
