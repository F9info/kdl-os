import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  getDetailPageTypesSchema,
  createTypeSchema,
  typeParamsSchema,
  createEntrySchema,
  updateEntrySchema,
  deleteEntrySchema,
  getPublicEntrySchema,
  convertLegacySchema,
} from './schema.js';
import { requireProject } from '../../middleware/project.js';
import { getDetailPageTypes, postType, removeType, postEntry, getEntries, patchEntry, removeEntry, getPublic, postConvertLegacy } from './controller.js';

const router = Router();

// Public — consumed by the generic /<slug_prefix>/<slug> site route.
router.get('/public/:prefix/:slug', validate(getPublicEntrySchema), getPublic);

router.get('/', authenticate, requirePermission('projects', 'view'), validate(getDetailPageTypesSchema), getDetailPageTypes);
// requireProject reads `projectId`; this API's body uses `project_id`.
const asProjectId = (req, _res, next) => {
  req.validated.body.projectId = req.validated.body.project_id;
  next();
};
router.post(
  '/convert-legacy',
  authenticate,
  requirePermission('projects', 'update'),
  validate(convertLegacySchema),
  asProjectId,
  requireProject('body'),
  postConvertLegacy
);
router.post('/', authenticate, requirePermission('projects', 'update'), validate(createTypeSchema), postType);
router.delete('/:typeKey', authenticate, requirePermission('projects', 'update'), validate(typeParamsSchema), removeType);
router.get('/:typeKey/entries', authenticate, requirePermission('projects', 'view'), validate(typeParamsSchema), getEntries);
router.post('/:typeKey/entries', authenticate, requirePermission('projects', 'update'), validate(createEntrySchema), postEntry);
router.patch('/entries/:id', authenticate, requirePermission('projects', 'update'), validate(updateEntrySchema), patchEntry);
router.delete('/entries/:id', authenticate, requirePermission('projects', 'update'), validate(deleteEntrySchema), removeEntry);

export default router;
