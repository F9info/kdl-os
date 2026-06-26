import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { listUsersSchema, getUserSchema, updateUserSchema, deleteUserSchema } from './schema.js';
import { listUsers, getUser, updateUser, deleteUser } from './controller.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

router.get('/', validate(listUsersSchema), listUsers);
router.get('/:id', validate(getUserSchema), getUser);
router.patch('/:id', validate(updateUserSchema), updateUser);
router.delete('/:id', validate(deleteUserSchema), deleteUser);

export default router;
