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
import { listSectors as listSectorEntities, resolveSectorBindings } from './service.js';
import { registerDetailPageType } from '../../shared/detail-pages/registry.js';

// Module load time (this file is always imported once by the module loader
// at boot, per shared/modules/module-loader.js) is this module's one and
// only registration point — no separate "entrypoint" file needed.
registerDetailPageType('sectors', {
  label: 'Sector detail',
  navParentLabel: 'Sectors',
  listEntities: (projectId) => listSectorEntities({ project_id: projectId }),
  publicPathFor: (sector) => `/sectors/${sector.slug}`,
  adminListPath: (projectId) => `/admin/sectors?projectId=${projectId}`,
  resolveEntityBindings: resolveSectorBindings,
});

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
