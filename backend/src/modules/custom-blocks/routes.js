import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  getAll,
  postCreate,
  putUpdate,
  postDuplicate,
  postSetDefault,
  remove,
} from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('page-builder', 'view'), getAll);
router.post('/', authenticate, requirePermission('page-builder', 'add'), postCreate);
router.put('/:id', authenticate, requirePermission('page-builder', 'edit'), putUpdate);
router.post(
  '/:id/duplicate',
  authenticate,
  requirePermission('page-builder', 'add'),
  postDuplicate
);
router.post(
  '/:id/set-default',
  authenticate,
  requirePermission('page-builder', 'edit'),
  postSetDefault
);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), remove);

export default router;
