import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import {
  getProviders,
  createProvider,
  updateProvider,
  deleteProvider,
  testProvider,
  webhookGetHandler,
  webhookHandler,
  getLogs,
} from './controller.js';

const router = Router();

router.get('/providers', authenticate, requirePermission('integrations', 'view'), getProviders);
router.post('/providers', authenticate, requirePermission('integrations', 'add'), createProvider);
router.patch('/providers/:id', authenticate, requirePermission('integrations', 'edit'), updateProvider);
router.delete('/providers/:id', authenticate, requirePermission('integrations', 'delete'), deleteProvider);
router.post('/providers/:id/test', authenticate, requirePermission('integrations', 'edit'), testProvider);

router.get('/webhooks/:driver', webhookGetHandler);
router.post('/webhooks/:driver', webhookHandler);

router.get('/logs', authenticate, requirePermission('integrations', 'view'), getLogs);

export default router;
