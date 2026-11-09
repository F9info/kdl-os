import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import { createProjectSchema, updateProjectSchema, answerOnboardingSchema, saveLayoutSchema, siteIdentityParamsSchema, saveSiteIdentitySchema, workflowStepSchema, launchSchema } from './schema.js';
import { handleGetLayout, handleSaveLayout, handleListSites, handleGetSiteIdentity, handleSaveSiteIdentity, handleGetOnboarding, handleAnswerOnboarding, handleList, handleGet, handleCreate, handleUpdate, handleDelete, handleWorkflowStep, handleLaunchCheck, handleLaunch } from './controller.js';

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
router.put('/:id/workflow', authenticate, requirePermission('projects', 'update'), requireProject((req) => req.params.id), validate(workflowStepSchema), handleWorkflowStep);
router.get('/:id/launch', authenticate, requirePermission('projects', 'view'), requireProject((req) => req.params.id), handleLaunchCheck);
// Launch publishes pages, so it needs the page-builder publish right as well as project update.
router.post('/:id/launch', authenticate, requirePermission('projects', 'update'), requirePermission('page-builder', 'publish'), requireProject((req) => req.params.id), validate(launchSchema), handleLaunch);
router.delete('/:id', authenticate, requirePermission('projects', 'delete'), handleDelete);

export default router;
