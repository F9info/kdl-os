import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listUsersSchema,
  getUserSchema,
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  resetPasswordSchema,
  updateOverridesSchema,
} from './schema.js';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  updateOverrides,
} from './controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('users', 'view'), validate(listUsersSchema), listUsers);
router.get('/:id', requirePermission('users', 'view'), validate(getUserSchema), getUser);
router.post('/', requirePermission('users', 'add'), validate(createUserSchema), createUser);
router.patch('/:id', requirePermission('users', 'edit'), validate(updateUserSchema), updateUser);
router.delete('/:id', requirePermission('users', 'delete'), validate(deleteUserSchema), deleteUser);
router.post('/:id/reset-password', requirePermission('users', 'edit'), validate(resetPasswordSchema), resetPassword);
router.put('/:id/overrides', requirePermission('permissions', 'edit'), validate(updateOverridesSchema), updateOverrides);

export default router;
