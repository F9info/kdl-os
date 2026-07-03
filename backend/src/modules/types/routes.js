import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listTypesSchema,
  getTypeSchema,
  createTypeSchema,
  updateTypeSchema,
  deleteTypeSchema,
} from './schema.js';
import { listTypes, getType, createType, updateType, deleteType } from './controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('types', 'view'), validate(listTypesSchema), listTypes);
router.get('/:id', requirePermission('types', 'view'), validate(getTypeSchema), getType);
router.post('/', requirePermission('types', 'add'), validate(createTypeSchema), createType);
router.patch('/:id', requirePermission('types', 'edit'), validate(updateTypeSchema), updateType);
router.delete('/:id', requirePermission('types', 'delete'), validate(deleteTypeSchema), deleteType);

export default router;
