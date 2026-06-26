import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
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
  uploadFile,
  removeGalleryItem,
} from './controller.js';

const router = Router();

router.use(authenticate, requireRole('ADMIN', 'SUPER_ADMIN'));

// Static / specific routes first so they are not shadowed by '/:id'.
router.get('/input-types', listInputTypes);
router.get('/by-type/:slug', validate(byTypeSchema), getFieldsByTypeSlug);
router.get('/value/:slug', validate(valueBySlugSchema), getValueBySlug);
router.post('/values', validate(saveValuesSchema), saveValues);
router.post('/upload', upload.single('file'), uploadFile);
router.patch('/reorder', validate(reorderFieldsSchema), reorderFields);
router.delete('/gallery-item/:id/:index', validate(removeGalleryItemSchema), removeGalleryItem);

router.get('/', validate(listFieldsSchema), listFields);
router.post('/', validate(createFieldSchema), createField);
router.get('/:id', validate(getFieldSchema), getField);
router.patch('/:id', validate(updateFieldSchema), updateField);
router.delete('/:id', validate(deleteFieldSchema), deleteField);

export default router;
