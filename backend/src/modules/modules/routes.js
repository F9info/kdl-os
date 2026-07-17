import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { settingsPatchSchema, slugParamSchema } from './schema.js';
import {
  getModules,
  getEnabledModules,
  postInstall,
  postEnable,
  postDisable,
  deleteModule,
  patchSettings,
} from './controller.js';

const router = Router();

router.get('/', authenticate, requirePermission('modules', 'view'), getModules);
router.get('/enabled', authenticate, getEnabledModules);
router.post('/:slug/install', authenticate, requirePermission('modules', 'add'), validate(slugParamSchema), postInstall);
router.post('/:slug/enable', authenticate, requirePermission('modules', 'edit'), validate(slugParamSchema), postEnable);
router.post('/:slug/disable', authenticate, requirePermission('modules', 'edit'), validate(slugParamSchema), postDisable);
router.delete('/:slug', authenticate, requirePermission('modules', 'delete'), validate(slugParamSchema), deleteModule);
router.patch('/:slug/settings', authenticate, requirePermission('modules', 'edit'), validate(settingsPatchSchema), patchSettings);

export default router;
