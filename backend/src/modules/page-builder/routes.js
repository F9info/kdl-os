import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, getOne, getPublic, postCreate, putUpdate, remove } from './controller.js';

const router = Router();

// Public read of a PUBLISHED page (consumed by the /p/[slug] renderer).
router.get('/public/:slug', getPublic);

// Admin CRUD — authenticated + RBAC-gated.
router.get('/', authenticate, requirePermission('page-builder', 'view'), getAll);
router.get('/:id', authenticate, requirePermission('page-builder', 'view'), getOne);
router.post('/', authenticate, requirePermission('page-builder', 'add'), postCreate);
router.put('/:id', authenticate, requirePermission('page-builder', 'edit'), putUpdate);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), remove);

export default router;
