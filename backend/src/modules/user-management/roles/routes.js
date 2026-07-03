import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/permission.js';
import { validate } from '../../../middleware/validate.js';
import {
  listRolesSchema,
  getRoleSchema,
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
} from './schema.js';
import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
} from './controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('roles', 'view'), validate(listRolesSchema), listRoles);
router.get('/:id', requirePermission('roles', 'view'), validate(getRoleSchema), getRole);
router.post('/', requirePermission('roles', 'add'), validate(createRoleSchema), createRole);
router.patch('/:id', requirePermission('roles', 'edit'), validate(updateRoleSchema), updateRole);
router.delete('/:id', requirePermission('roles', 'delete'), validate(deleteRoleSchema), deleteRole);

export default router;
