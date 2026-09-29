import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  listCatalogSchema,
  getCatalogSchema,
  getPublicCatalogSchema,
  createCatalogSchema,
  updateCatalogSchema,
  deleteCatalogSchema,
} from './schema.js';
import {
  listCatalog,
  getCatalog,
  getPublicCatalog,
  createCatalog,
  updateCatalog,
  deleteCatalog,
} from './controller.js';
import { listCatalog as listCatalogEntities, resolveCatalogBindings } from './service.js';
import { registerDetailPageType } from '../../shared/detail-pages/registry.js';

// Module load time (this file is always imported once by the module loader
// at boot) is this module's one and only registration point — same pattern
// as sectors/routes.js and work/routes.js.
registerDetailPageType('catalog', {
  label: 'Catalog detail',
  navParentLabel: 'Products & Services',
  listEntities: (projectId) => listCatalogEntities({ project_id: projectId }),
  publicPathFor: (item) => `/catalog/${item.slug}`,
  adminListPath: (projectId) => `/admin/catalog?projectId=${projectId}`,
  resolveEntityBindings: resolveCatalogBindings,
});

const router = Router();

// Public — consumed by /catalog/[slug].
router.get('/public', validate(listCatalogSchema), listCatalog);
router.get('/public/:slug', validate(getPublicCatalogSchema), getPublicCatalog);

// Admin CRUD — authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('catalog', 'view'), validate(listCatalogSchema), listCatalog);
router.get('/:id', requirePermission('catalog', 'view'), validate(getCatalogSchema), getCatalog);
router.post('/', requirePermission('catalog', 'add'), validate(createCatalogSchema), createCatalog);
router.patch('/:id', requirePermission('catalog', 'edit'), validate(updateCatalogSchema), updateCatalog);
router.delete('/:id', requirePermission('catalog', 'delete'), validate(deleteCatalogSchema), deleteCatalog);

export default router;
