import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { createProjectSchema, updateProjectSchema } from './schema.js';
import { handleList, handleGet, handleCreate, handleUpdate, handleDelete } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('projects', 'view'), handleList);
router.get('/:id', authenticate, requirePermission('projects', 'view'), handleGet);
router.post('/', authenticate, requirePermission('projects', 'create'), validate(createProjectSchema), handleCreate);
router.patch('/:id', authenticate, requirePermission('projects', 'update'), validate(updateProjectSchema), handleUpdate);
router.delete('/:id', authenticate, requirePermission('projects', 'delete'), handleDelete);

export default router;
