import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { publicOnlyActive } from '../../middleware/public-only-active.js';
import { listGallerySchema, idParamSchema, createGallerySchema, updateGallerySchema } from './schema.js';
import { list, get, create, update, remove } from './controller.js';

const router = Router();

// Public read of active items (consumed by the GalleryGrid block on /p/[slug]).
router.get('/public', validate(listGallerySchema), publicOnlyActive, list);

router.use(authenticate);
router.get('/', requirePermission('gallery', 'view'), validate(listGallerySchema), list);
router.get('/:id', requirePermission('gallery', 'view'), validate(idParamSchema), get);
router.post('/', requirePermission('gallery', 'add'), validate(createGallerySchema), create);
router.patch('/:id', requirePermission('gallery', 'edit'), validate(updateGallerySchema), update);
router.delete('/:id', requirePermission('gallery', 'delete'), validate(idParamSchema), remove);

export default router;
