import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/permission.js';
import { validate } from '../../../middleware/validate.js';
import { listActivityLogSchema } from './schema.js';
import { listActivity } from './controller.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('activity-log', 'view'), validate(listActivityLogSchema), listActivity);

export default router;
