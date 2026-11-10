import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import * as service from './service.js';
import { z } from 'zod';
import { buildSite, buildSiteModel, buildLandingModel, collectSiteInput, siteExists, writeSite } from './site/generator.js';
import { normalizeSiteUrl } from './site/export-content.js';
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
// The site's forms post to this address from every visitor's browser: https only, no credentials in it, no internal
// hosts, and, when STATIC_API_BASE_ALLOWLIST (comma separated hostnames) is set, only those hosts.
export const checkApiBase = (value) => {
  if (!value) return { ok: true, value: undefined };
  let u;
  try { u = new URL(value); } catch { return { ok: false, reason: 'apiBase must be a full URL' }; }
  if (u.protocol !== 'https:') return { ok: false, reason: 'apiBase must start with https://' };
  if (u.username || u.password) return { ok: false, reason: 'apiBase must not contain a username or password' };
  const host = u.hostname.toLowerCase();
  if (/^(localhost|.*\.local|.*\.internal)$/.test(host) || /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/.test(host))
    return { ok: false, reason: 'apiBase must be a public address' };
  const allowed = (process.env.STATIC_API_BASE_ALLOWLIST || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(host)) return { ok: false, reason: 'apiBase host is not on the allowed list' };
  return { ok: true, value: u.origin + u.pathname.replace(/\/$/, '') };
};

async function siteSlug(projectId) {
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null } });
  return project && (await siteExists(project.slug)) ? project.slug : null;
}

// Starts the build of `exportModel` in the site folder `slug`; answers the request itself on a refusal.
async function launchBuild(req, res, slug, exportModel, what) {
  const parsed = checkApiBase(req.body?.apiBase || undefined);
  if (!parsed.ok) return errorResponse(res, parsed.reason, 422);
  // Where the exported site will be hosted. Optional: it gives pages a canonical address and makes the sitemap possible.
  const siteUrl = req.body?.siteUrl ? normalizeSiteUrl(req.body.siteUrl) : null;
  if (req.body?.siteUrl && !siteUrl) return errorResponse(res, 'siteUrl must be a full http(s) address', 422);
  // The company's contact details travel into the build: a form on the static site shows them.
  const identity = await getIdentity();
  const contact = { email: identity.contact_email, phone: identity.contact_phone };
  // The site's theme is baked into the folder: a static site cannot ask a server for it later.
  const tokens = await compileTokens('webapp', undefined, undefined, req.projectId);
  const started = startStaticBuild(slug, { apiBase: parsed.value, siteUrl, exportModel, contact, identity, tokens: { css: tokens.css, activeTheme: tokens.activeTheme } });
  if (started === 'running') return errorResponse(res, 'A build is already running', 409);
  if (started === 'busy') return errorResponse(res, 'The server is busy with another export. Try again in a few minutes.', 429);
  writeActivityAsync({
    actor: req.user.id,
    module: 'template-engine',
    action: 'static_export_started',
    subject_type: 'Project',
    subject_id: req.projectId,
    description: `Started static export of ${what} "${slug}"`,
    properties: { projectId: req.projectId, apiBase: parsed.value ?? null, siteUrl },
    ip_address: getClientIp(req),
  });
  return successResponse(res, getStaticBuild(slug), 202);
}

export const startStatic = async (req, res, next) => {
  try {
    const bad = checkApiBase(req.body?.apiBase || undefined);
    if (!bad.ok) return errorResponse(res, bad.reason, 422);
    const slug = await siteSlug(req.projectId);
    if (!slug) return errorResponse(res, 'Prepare the project folder first', 409);
    // The export holds the published pages (website and landing); the live site folder keeps showing drafts.
    const exportModel = buildSiteModel(await collectSiteInput(req.projectId, { publishedOnly: true }), { exportOnly: true });
    return await launchBuild(req, res, slug, exportModel, 'site');
  } catch (err) {
    next(err);
  }
};

// One landing page of the project, with its own folder name (see buildLandingModel).
async function landingFolder(req) {
  const [site, project] = await Promise.all([
    prisma.site.findFirst({ where: { id: req.params.siteId, project_id: req.projectId, type: 'LANDING', deleted_at: null } }),
    prisma.project.findFirst({ where: { id: req.projectId, deleted_at: null } }),
  ]);
  if (!site || !project) return null;
  const page = await prisma.builderPage.findFirst({ where: { site_id: site.id, deleted_at: null }, select: { slug: true } });
  return page ? `${project.slug}-${page.slug}` : null;
}

export const startLandingStatic = async (req, res, next) => {
  try {
    const folder = await landingFolder(req);
    if (!folder) return errorResponse(res, 'Landing page not found', 404);
    const bad = checkApiBase(req.body?.apiBase || undefined);
    if (!bad.ok) return errorResponse(res, bad.reason, 422);
    const model = buildLandingModel(await collectSiteInput(req.projectId, { publishedOnly: true }), req.params.siteId);
    if (!model) return errorResponse(res, 'Save the landing page first. Only a saved page can be converted.', 409);
    await writeSite(model); // the page's own site folder (rewritten on every Convert, so edits always come along)
    return await launchBuild(req, res, model.site.slug, model, 'landing page');
  } catch (err) {
    next(err);
  }
};

export const landingStaticStatus = async (req, res, next) => {
  try {
    const folder = await landingFolder(req);
    return successResponse(res, folder ? getStaticBuild(folder) : { state: 'idle', log: '' });
  } catch (err) {
    next(err);
  }
};

export const landingStaticDownload = async (req, res, next) => {
  try {
    const folder = await landingFolder(req);
    const buf = folder ? zipStaticBuild(folder) : null;
    if (!buf) return errorResponse(res, 'No finished static build', 404);
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'static_export_downloaded',
      subject_type: 'Project',
      subject_id: req.projectId,
      description: `Downloaded static export of landing page "${folder}"`,
      properties: { projectId: req.projectId, bytes: buf.length },
      ip_address: getClientIp(req),
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${folder}-static.zip"`);
    return res.end(buf);
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
    writeActivityAsync({
      actor: req.user.id,
      module: 'template-engine',
      action: 'static_export_downloaded',
      subject_type: 'Project',
      subject_id: req.projectId,
      description: `Downloaded static export of "${slug}"`,
      properties: { projectId: req.projectId, bytes: buf.length },
      ip_address: getClientIp(req),
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}-static.zip"`);
    return res.end(buf);
  } catch (err) {
    next(err);
  }
};
