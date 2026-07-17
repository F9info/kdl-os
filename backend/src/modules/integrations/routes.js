import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { getLogsQuerySchema } from './schema.js';
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

// L10: dedicated rate limiter for webhook endpoints (200 req/min per IP).
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many webhook requests' },
});

const router = Router();

router.get('/providers', authenticate, requirePermission('integrations', 'view'), getProviders);
router.post('/providers', authenticate, requirePermission('integrations', 'add'), createProvider);
router.patch('/providers/:id', authenticate, requirePermission('integrations', 'edit'), updateProvider);
router.delete('/providers/:id', authenticate, requirePermission('integrations', 'delete'), deleteProvider);
router.post('/providers/:id/test', authenticate, requirePermission('integrations', 'edit'), testProvider);

router.get('/webhooks/:driver', webhookLimiter, webhookGetHandler);
router.post('/webhooks/:driver', webhookLimiter, webhookHandler);

router.get('/logs', authenticate, requirePermission('integrations', 'view'), validate(getLogsQuerySchema), getLogs);

export default router;
