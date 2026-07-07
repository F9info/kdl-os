import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, postCreate } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('integrations', 'view'), getAll);
router.post('/', authenticate, requirePermission('integrations', 'add'), postCreate);

export default router;
