import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listCaseStudiesSchema,
  getCaseStudySchema,
  createCaseStudySchema,
  updateCaseStudySchema,
  deleteCaseStudySchema,
} from './schema.js';
import {
  listCaseStudies,
  getCaseStudy,
  createCaseStudy,
  updateCaseStudy,
  deleteCaseStudy,
} from './controller.js';

const router = Router();

// Public read of active case studies (consumed by ConstructionProjectsSlider,
// on both the editor canvas and /p/[slug]).
router.get('/public', validate(listCaseStudiesSchema), listCaseStudies);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('projects-content', 'view'), validate(listCaseStudiesSchema), listCaseStudies);
router.get('/:id', requirePermission('projects-content', 'view'), validate(getCaseStudySchema), getCaseStudy);
router.post('/', requirePermission('projects-content', 'add'), validate(createCaseStudySchema), createCaseStudy);
router.patch(
  '/:id',
  requirePermission('projects-content', 'edit'),
  validate(updateCaseStudySchema),
  updateCaseStudy
);
router.delete(
  '/:id',
  requirePermission('projects-content', 'delete'),
  validate(deleteCaseStudySchema),
  deleteCaseStudy
);

export default router;
