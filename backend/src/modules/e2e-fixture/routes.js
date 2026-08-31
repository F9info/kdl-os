import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { getAll, postCreate } from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('e2e-fixture', 'view'), getAll);
router.post('/', authenticate, requirePermission('e2e-fixture', 'add'), postCreate);

export default router;
