import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
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

router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/', validate(listTypesSchema), listTypes);
router.get('/:id', validate(getTypeSchema), getType);
router.post('/', validate(createTypeSchema), createType);
router.patch('/:id', validate(updateTypeSchema), updateType);
router.delete('/:id', validate(deleteTypeSchema), deleteType);

export default router;
