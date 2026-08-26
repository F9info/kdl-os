import { Router } from 'express';
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
