import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createRunBodySchema,
  runParamSchema,
  listRunsQuerySchema,
  advanceStageSchema,
} from './schema.js';
import {
  createRun,
  listRuns,
  getRun,
  resumeRun,
  advanceStage,
  getExport,
} from './controller.js';

const router = Router();

// All routes require authentication.
router.use(authenticate);

// Run management.
router.post('/runs', requirePermission('template-engine', 'run'), validate(createRunBodySchema), createRun);
router.get('/runs', requirePermission('template-engine', 'view'), validate(listRunsQuerySchema), listRuns);
router.get('/runs/:runId', requirePermission('template-engine', 'view'), validate(runParamSchema), getRun);

// Crash-recovery: call at startup to flip RUNNING → FAILED(INTERRUPTED).
router.post('/runs/:runId/resume', requirePermission('template-engine', 'run'), validate(runParamSchema), resumeRun);

// Stage advance — single endpoint for all transitions.
// Permission enforced per-stage in controller (run vs approve vs export).
router.post('/runs/:runId/stages/:stage/advance', requirePermission('template-engine', 'run'), validate(advanceStageSchema), advanceStage);

// Export — requires :export permission (TEMPLATE_ENGINE_ARCH.md §9).
router.get('/runs/:runId/export', requirePermission('template-engine', 'export'), validate(runParamSchema), getExport);

export default router;
