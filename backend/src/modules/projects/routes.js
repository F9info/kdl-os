import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { createProjectSchema, updateProjectSchema, answerOnboardingSchema } from './schema.js';
import { handleGetOnboarding, handleAnswerOnboarding, handleList, handleGet, handleCreate, handleUpdate, handleDelete } from './controller.js';

const router = Router();

// First-run "front-end website needed?" question — registered before /:id.
router.get('/onboarding', authenticate, requirePermission('projects', 'view'), handleGetOnboarding);
router.post('/onboarding', authenticate, requirePermission('projects', 'update'), validate(answerOnboardingSchema), handleAnswerOnboarding);

router.get('/', authenticate, requirePermission('projects', 'view'), handleList);
router.get('/:id', authenticate, requirePermission('projects', 'view'), handleGet);
router.post('/', authenticate, requirePermission('projects', 'create'), validate(createProjectSchema), handleCreate);
router.patch('/:id', authenticate, requirePermission('projects', 'update'), validate(updateProjectSchema), handleUpdate);
router.delete('/:id', authenticate, requirePermission('projects', 'delete'), handleDelete);

export default router;
