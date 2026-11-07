import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { requestProject } from '../../middleware/request-project.js';
import { createLandingSchema } from './schema.js';
import { handleTemplates, handlePreview, handleList, handleCreate, handleDelete } from './controller.js';

const router = Router();
router.use(authenticate);

router.get('/templates', requirePermission('landing', 'view'), handleTemplates);
router.get('/templates/:key/preview', requirePermission('landing', 'view'), handlePreview);
router.get('/', requirePermission('landing', 'view'), requestProject, handleList);
router.post('/', requirePermission('landing', 'add'), requestProject, validate(createLandingSchema), handleCreate);

router.delete('/:siteId', requirePermission('landing', 'delete'), requestProject, handleDelete);

export default router;
