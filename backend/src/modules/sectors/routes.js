import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listSectorsSchema,
  getSectorSchema,
  getPublicSectorSchema,
  createSectorSchema,
  updateSectorSchema,
  deleteSectorSchema,
} from './schema.js';
import {
  listSectors,
  getSector,
  getPublicSector,
  createSector,
  updateSector,
  deleteSector,
} from './controller.js';

const router = Router();

// Public read of active sectors (consumed by ConstructionSectorDetailList, on
// both the editor canvas and /p/[slug]).
router.get('/public', validate(listSectorsSchema), listSectors);

// Public read of one sector by slug, joined with its linked detail page's
// content — consumed by the dynamic /sectors/[slug] route.
router.get('/public/:slug', validate(getPublicSectorSchema), getPublicSector);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('sectors', 'view'), validate(listSectorsSchema), listSectors);
router.get('/:id', requirePermission('sectors', 'view'), validate(getSectorSchema), getSector);
router.post('/', requirePermission('sectors', 'add'), validate(createSectorSchema), createSector);
router.patch('/:id', requirePermission('sectors', 'edit'), validate(updateSectorSchema), updateSector);
router.delete('/:id', requirePermission('sectors', 'delete'), validate(deleteSectorSchema), deleteSector);

export default router;
