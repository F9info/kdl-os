import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { requestProject } from '../../middleware/request-project.js';
import { createLandingSchema, duplicateTemplateSchema, updateTemplateSchema, saveAsTemplateSchema } from './schema.js';
import {
  handleTemplates, handlePreview, handleList, handleCreate, handleDelete,
  handleDuplicateTemplate, handleUpdateTemplate, handleDeleteTemplate, handleSaveAsTemplate,
} from './controller.js';

const router = Router();
router.use(authenticate);

router.get('/templates', requirePermission('landing', 'view'), handleTemplates);
router.get('/templates/:key/preview', requirePermission('landing', 'view'), handlePreview);
// Template library: duplicate, rename, delete, and save a landing page as a template.
router.post('/templates', requirePermission('landing', 'add'), requestProject, validate(saveAsTemplateSchema), handleSaveAsTemplate);
router.post('/templates/:key/duplicate', requirePermission('landing', 'add'), validate(duplicateTemplateSchema), handleDuplicateTemplate);
router.put('/templates/:key', requirePermission('landing', 'edit'), validate(updateTemplateSchema), handleUpdateTemplate);
router.delete('/templates/:key', requirePermission('landing', 'delete'), handleDeleteTemplate);
router.get('/', requirePermission('landing', 'view'), requestProject, handleList);
router.post('/', requirePermission('landing', 'add'), requestProject, validate(createLandingSchema), handleCreate);

router.delete('/:siteId', requirePermission('landing', 'delete'), requestProject, handleDelete);

export default router;
