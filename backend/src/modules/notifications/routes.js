import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, postCreate } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('notifications', 'view'), getAll);
router.post('/', authenticate, requirePermission('notifications', 'add'), postCreate);

export default router;
