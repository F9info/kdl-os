import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import {
  listFieldsSchema,
  getFieldSchema,
  createFieldSchema,
  updateFieldSchema,
  deleteFieldSchema,
  reorderFieldsSchema,
  byTypeSchema,
  valueBySlugSchema,
  valuesBySlugsSchema,
  saveValuesSchema,
  removeGalleryItemSchema,
} from './schema.js';
import {
  listInputTypes,
  listFields,
  getField,
  createField,
  updateField,
  deleteField,
  reorderFields,
  getFieldsByTypeSlug,
  saveValues,
  getValueBySlug,
  getPublicValues,
  uploadFile,
  removeGalleryItem,
} from './controller.js';

const router = Router();

// Public read of plain-text field values (consumed by page-builder blocks
// like ConstructionAboutSplit/ConstructionMissionVision/
// ConstructionTaglineStrip, on both the editor canvas and /p/[slug]) —
// mirrors the /public convention used by the team/faq/projects-content
// modules. Every other route below stays authenticated — this is the only
// public one in this module.
router.get('/public/values', validate(valuesBySlugsSchema), getPublicValues);

router.use(authenticate);

// Static / specific routes first so they are not shadowed by '/:id'.
router.get('/input-types', requirePermission('setting-fields', 'view'), listInputTypes);
router.get('/by-type/:slug', requirePermission('setting-fields', 'view'), validate(byTypeSchema), getFieldsByTypeSlug);
router.get('/value/:slug', requirePermission('setting-fields', 'view'), validate(valueBySlugSchema), getValueBySlug);
router.post('/values', requirePermission('setting-fields', 'edit'), validate(saveValuesSchema), saveValues);
router.post('/upload', requirePermission('setting-fields', 'edit'), upload.single('file'), uploadFile);
router.patch('/reorder', requirePermission('setting-fields', 'edit'), validate(reorderFieldsSchema), reorderFields);
router.delete('/gallery-item/:id/:index', requirePermission('setting-fields', 'delete'), validate(removeGalleryItemSchema), removeGalleryItem);

router.get('/', requirePermission('setting-fields', 'view'), validate(listFieldsSchema), listFields);
router.post('/', requirePermission('setting-fields', 'add'), validate(createFieldSchema), createField);
router.get('/:id', requirePermission('setting-fields', 'view'), validate(getFieldSchema), getField);
router.patch('/:id', requirePermission('setting-fields', 'edit'), validate(updateFieldSchema), updateField);
router.delete('/:id', requirePermission('setting-fields', 'delete'), validate(deleteFieldSchema), deleteField);

export default router;
