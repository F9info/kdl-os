import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { createProjectSchema, updateProjectSchema, answerOnboardingSchema, saveLayoutSchema, siteIdentityParamsSchema, saveSiteIdentitySchema } from './schema.js';
import { handleGetLayout, handleSaveLayout, handleListSites, handleGetSiteIdentity, handleSaveSiteIdentity, handleGetOnboarding, handleAnswerOnboarding, handleList, handleGet, handleCreate, handleUpdate, handleDelete } from './controller.js';

const router = Router();

// First-run "front-end website needed?" question — registered before /:id.
router.get('/onboarding', authenticate, requirePermission('projects', 'view'), handleGetOnboarding);
router.post('/onboarding', authenticate, requirePermission('projects', 'update'), validate(answerOnboardingSchema), handleAnswerOnboarding);

router.get('/', authenticate, requirePermission('projects', 'view'), handleList);
router.get('/:id', authenticate, requirePermission('projects', 'view'), handleGet);
router.get('/:id/sites', authenticate, requirePermission('projects', 'view'), handleListSites);
router.get('/:id/sites/:siteId/identity', authenticate, requirePermission('projects', 'view'), validate(siteIdentityParamsSchema), handleGetSiteIdentity);
router.put('/:id/sites/:siteId/identity', authenticate, requirePermission('projects', 'update'), validate(saveSiteIdentitySchema), handleSaveSiteIdentity);
router.get('/:id/layout', authenticate, requirePermission('projects', 'view'), handleGetLayout);
router.put('/:id/layout', authenticate, requirePermission('projects', 'update'), validate(saveLayoutSchema), handleSaveLayout);
router.post('/', authenticate, requirePermission('projects', 'create'), validate(createProjectSchema), handleCreate);
router.patch('/:id', authenticate, requirePermission('projects', 'update'), validate(updateProjectSchema), handleUpdate);
router.delete('/:id', authenticate, requirePermission('projects', 'delete'), handleDelete);

export default router;
