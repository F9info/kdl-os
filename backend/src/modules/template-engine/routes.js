import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { RedisRateLimitStore } from '../../shared/utils/redis-rate-limit-store.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import {
  createRunBodySchema,
  runParamSchema,
  listRunsQuerySchema,
  advanceStageSchema,
  stageRecoveryParamSchema,
} from './schema.js';
import {
  createRun,
  createSite,
  startStatic,
  staticStatus,
  staticDownload,
  listRuns,
  getRun,
  resumeRun,
  advanceStage,
  getExport,
  retryStage,
  skipStage,
} from './controller.js';

const router = Router();

// All routes require authentication.
router.use(authenticate);

// Run management.
router.post('/runs', requirePermission('template-engine', 'run'), validate(createRunBodySchema), requireProject('body'), createRun);
router.get('/runs', requirePermission('template-engine', 'view'), validate(listRunsQuerySchema), requireProject('query'), listRuns);
router.get('/runs/:runId', requirePermission('template-engine', 'view'), validate(runParamSchema), requireProject(), getRun);

// Generate the project's standalone Next.js site folder (frontend/projects/<slug>).
router.post('/site', requirePermission('template-engine', 'run'), validate(createRunBodySchema), requireProject('body'), createSite);

// One-click static export: start a build, poll status, download the zip.
// A build runs npm and the site's dependencies, so it is limited per person as well as globally (static-build.js).
// Needs the export permission, like the download: the result is a copy of the whole site that leaves the system.
export const staticBuildLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore('static-build'),
  keyGenerator: (req) => String(req.user?.id ?? req.ip),
  message: { success: false, message: 'Too many exports started. Try again in an hour.' },
});
router.post('/site/static', requirePermission('template-engine', 'export'), staticBuildLimiter, requireProject(), startStatic);
router.get('/site/static', requirePermission('template-engine', 'view'), requireProject(), staticStatus);
router.get('/site/static/download', requirePermission('template-engine', 'export'), requireProject(), staticDownload);

// Crash-recovery: call at startup to flip RUNNING → FAILED(INTERRUPTED).
router.post('/runs/:runId/resume', requirePermission('template-engine', 'run'), validate(runParamSchema), requireProject(), resumeRun);

// Stage advance — single endpoint for all transitions.
// Permission enforced per-stage in controller (run vs approve vs export).
router.post('/runs/:runId/stages/:stage/advance', requirePermission('template-engine', 'run'), validate(advanceStageSchema), requireProject(), advanceStage);

// Stage recovery — retry resets FAILED → PENDING; skip moves FAILED optional → SKIPPED.
router.post('/runs/:runId/stages/:stage/retry', requirePermission('template-engine', 'run'), validate(stageRecoveryParamSchema), requireProject(), retryStage);
router.post('/runs/:runId/stages/:stage/skip', requirePermission('template-engine', 'run'), validate(stageRecoveryParamSchema), requireProject(), skipStage);

// Export — requires :export permission (TEMPLATE_ENGINE_ARCH.md §9).
router.get('/runs/:runId/export', requirePermission('template-engine', 'export'), validate(runParamSchema), requireProject(), getExport);

export default router;
