import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
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
router.post('/:slug/install', authenticate, requirePermission('modules', 'add'), postInstall);
router.post('/:slug/enable', authenticate, requirePermission('modules', 'edit'), postEnable);
router.post('/:slug/disable', authenticate, requirePermission('modules', 'edit'), postDisable);
router.delete('/:slug', authenticate, requirePermission('modules', 'delete'), deleteModule);
router.patch('/:slug/settings', authenticate, requirePermission('modules', 'edit'), patchSettings);

export default router;
