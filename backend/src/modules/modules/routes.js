import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { graphQuerySchema, productsBodySchema, settingsPatchSchema, slugParamSchema, resolveConflictsSchema } from './schema.js';
import {
  getModules,
  getEnabledModules,
  getGraph,
  putProducts,
  postInstall,
  postEnable,
  postDisable,
  deleteModule,
  patchSettings,
} from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('modules', 'view'), getModules);
router.get('/enabled', authenticate, getEnabledModules);
router.get('/graph', authenticate, requirePermission('modules', 'view'), validate(graphQuerySchema), getGraph);
router.put('/products', authenticate, requirePermission('modules', 'edit'), requirePermission('modules', 'add'), validate(productsBodySchema), putProducts);
router.post('/:slug/install', authenticate, requirePermission('modules', 'add'), validate(resolveConflictsSchema), postInstall);
router.post('/:slug/enable', authenticate, requirePermission('modules', 'edit'), validate(resolveConflictsSchema), postEnable);
router.post('/:slug/disable', authenticate, requirePermission('modules', 'edit'), validate(slugParamSchema), postDisable);
router.delete('/:slug', authenticate, requirePermission('modules', 'delete'), validate(slugParamSchema), deleteModule);
router.patch('/:slug/settings', authenticate, requirePermission('modules', 'edit'), validate(settingsPatchSchema), patchSettings);

export default router;
