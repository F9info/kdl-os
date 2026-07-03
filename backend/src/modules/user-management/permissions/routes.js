import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/permission.js';
import { validate } from '../../../middleware/validate.js';
import {
  matrixSchema,
  createModuleSchema,
  updateModuleSchema,
  deleteModuleSchema,
} from './schema.js';
import {
  getMatrix,
  createModule,
  updateModule,
  deleteModule,
} from './controller.js';

const router = Router();

router.use(authenticate);

router.get('/matrix', requirePermission('permissions', 'view'), validate(matrixSchema), getMatrix);
router.post('/modules', requirePermission('permissions', 'add'), validate(createModuleSchema), createModule);
router.patch('/modules/:id', requirePermission('permissions', 'edit'), validate(updateModuleSchema), updateModule);
router.delete('/modules/:id', requirePermission('permissions', 'delete'), validate(deleteModuleSchema), deleteModule);

export default router;
