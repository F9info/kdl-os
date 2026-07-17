import { Router } from 'express';
import { moduleGate } from '../../middleware/module-gate.js';
import { authenticate, createAuthenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';

// SSE connections cannot set headers; accept token from query string as fallback.
// Shares the full authenticate pipeline — including the forced-password-change
// gate (KDL-283) — so the stream is never reachable on seeded credentials.
const authenticateSSE = createAuthenticate({
  getToken: (req) =>
    req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : (req.query.token ?? null),
});
import {
  listOwnNotifications,
  getUnreadCount,
  markOneRead,
  markAllRead,
  deleteOwnNotification,
  getOwnPreferences,
  updateOwnPreferences,
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  previewTemplate,
  broadcast,
  listCategories,
  createCategory,
  updateCategory,
  sseStream,
} from './controller.js';

const router = Router();

// All routes require the notifications module to be enabled
router.use(moduleGate('notifications'));

// ─── SSE (before param routes to avoid clash with /:id) ──────────────────────
router.get('/stream', authenticateSSE, sseStream);

// ─── User-facing: own notifications ──────────────────────────────────────────
router.get('/', authenticate, listOwnNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.post('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, markOneRead);
router.delete('/:id', authenticate, deleteOwnNotification);

// ─── Preferences ─────────────────────────────────────────────────────────────
router.get('/preferences', authenticate, getOwnPreferences);
router.put('/preferences', authenticate, updateOwnPreferences);

// ─── Admin: categories ────────────────────────────────────────────────────────
router.get('/categories', authenticate, requirePermission('notifications', 'view'), listCategories);
router.post('/categories', authenticate, requirePermission('notifications', 'add'), createCategory);
router.patch('/categories/:id', authenticate, requirePermission('notifications', 'edit'), updateCategory);

// ─── Admin: templates ─────────────────────────────────────────────────────────
router.get('/templates', authenticate, requirePermission('notifications', 'view'), listTemplates);
router.post('/templates', authenticate, requirePermission('notifications', 'add'), createTemplate);
router.patch('/templates/:id', authenticate, requirePermission('notifications', 'edit'), updateTemplate);
router.delete('/templates/:id', authenticate, requirePermission('notifications', 'delete'), deleteTemplate);
router.post('/templates/:id/preview', authenticate, requirePermission('notifications', 'view'), previewTemplate);

// ─── Admin: broadcast ─────────────────────────────────────────────────────────
router.post('/broadcast', authenticate, requirePermission('notifications', 'publish'), broadcast);

export default router;
