import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, postCreate } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('example', 'view'), getAll);
router.post('/', authenticate, requirePermission('example', 'add'), postCreate);

export default router;
