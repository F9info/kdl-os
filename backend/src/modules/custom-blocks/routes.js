import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import {
  createCustomBlockSchema,
  listCustomBlocksQuerySchema,
  customBlockIdParamSchema,
  updateCustomBlockSchema,
} from './schema.js';
import {
  getAll,
  postCreate,
  putUpdate,
  postDuplicate,
  postSetDefault,
  remove,
} from './controller.js';

const router = Router();

router.use(authenticate);

// No project context to check when projectId is omitted (the legacy Page
// Builder editor has no project concept) — listing then spans every
// project, gated only by the page-builder 'view' permission above.
function requireProjectIfPresent(req, res, next) {
  if (!req.validated.query.projectId) return next();
  return requireProject('query')(req, res, next);
}

router.get(
  '/',
  requirePermission('page-builder', 'view'),
  validate(listCustomBlocksQuerySchema),
  requireProjectIfPresent,
  getAll
);
router.post(
  '/',
  requirePermission('page-builder', 'add'),
  validate(createCustomBlockSchema),
  requireProject('body'),
  postCreate
);
router.put(
  '/:id',
  requirePermission('page-builder', 'edit'),
  validate(updateCustomBlockSchema),
  requireProject(),
  putUpdate
);
router.post(
  '/:id/duplicate',
  requirePermission('page-builder', 'add'),
  validate(customBlockIdParamSchema),
  requireProject(),
  postDuplicate
);
router.post(
  '/:id/set-default',
  requirePermission('page-builder', 'edit'),
  validate(customBlockIdParamSchema),
  requireProject(),
  postSetDefault
);
router.delete(
  '/:id',
  requirePermission('page-builder', 'delete'),
  validate(customBlockIdParamSchema),
  requireProject(),
  remove
);

export default router;
