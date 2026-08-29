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

router.get(
  '/',
  requirePermission('page-builder', 'view'),
  validate(listCustomBlocksQuerySchema),
  requireProject('query'),
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
