import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { createLandingSchema } from './schema.js';
import { handleTemplates, handleList, handleCreate } from './controller.js';

const router = Router();
router.use(authenticate);

router.get('/templates', requirePermission('landing', 'view'), handleTemplates);
router.get('/', requirePermission('landing', 'view'), handleList);
router.post('/', requirePermission('landing', 'add'), validate(createLandingSchema), handleCreate);

export default router;
