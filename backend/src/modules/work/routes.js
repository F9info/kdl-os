import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listWorkSchema,
  getWorkSchema,
  getPublicWorkSchema,
  createWorkSchema,
  updateWorkSchema,
  deleteWorkSchema,
} from './schema.js';
import {
  listWork,
  getWork,
  getPublicWork,
  createWork,
  updateWork,
  deleteWork,
} from './controller.js';
import { listWork as listWorkEntities } from './service.js';
import { registerDetailPageType } from '../../shared/detail-pages/registry.js';

registerDetailPageType('work', {
  label: 'Work detail',
  navParentLabel: 'Work',
  listEntities: (projectId) => listWorkEntities({ project_id: projectId }),
  publicPathFor: (work) => `/work/${work.slug}`,
  adminListPath: (projectId) => `/admin/work?projectId=${projectId}`,
});

const router = Router();

// Public — consumed by /work/[slug].
router.get('/public', validate(listWorkSchema), listWork);
router.get('/public/:slug', validate(getPublicWorkSchema), getPublicWork);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('work', 'view'), validate(listWorkSchema), listWork);
router.get('/:id', requirePermission('work', 'view'), validate(getWorkSchema), getWork);
router.post('/', requirePermission('work', 'add'), validate(createWorkSchema), createWork);
router.patch('/:id', requirePermission('work', 'edit'), validate(updateWorkSchema), updateWork);
router.delete('/:id', requirePermission('work', 'delete'), validate(deleteWorkSchema), deleteWork);

export default router;
