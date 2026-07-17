import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { moduleGate } from '../../middleware/module-gate.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const SSE_TICKET_TTL = 30; // seconds — one-time use, short-lived

// SSE connections cannot set custom headers; clients exchange a short-lived one-time
// ticket (issued via POST /notifications/sse-ticket) for identity instead of
// sending the JWT in the query string where it appears in logs and browser history.
async function authenticateSSE(req, res, next) {
  const headerToken = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  if (headerToken) {
    try {
      const payload = jwt.verify(headerToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, status: true, deleted_at: true },
      });
      if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
        return errorResponse(res, 'Account is inactive', 403);
      }
      req.user = { ...payload, id: user.id, status: user.status };
      return next();
    } catch {
      return errorResponse(res, 'Invalid or expired token', 401);
    }
  }

  const ticket = req.query.ticket;
  if (!ticket) return errorResponse(res, 'No credentials provided', 401);

  const key = `notif:sse-ticket:${ticket}`;
  const userId = await redis.getdel(key);
  if (!userId) return errorResponse(res, 'Invalid or expired SSE ticket', 401);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, deleted_at: true },
  });
  if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
    return errorResponse(res, 'Account is inactive', 403);
  }
  req.user = { id: user.id, userId: user.id, status: user.status };
  next();
}
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

// ─── SSE ticket — must be obtained by authenticated clients before opening the stream ─
router.post('/sse-ticket', authenticate, async (req, res) => {
  const ticket = randomUUID();
  await redis.set(`notif:sse-ticket:${ticket}`, req.user.id, 'EX', SSE_TICKET_TTL);
  successResponse(res, { ticket });
});

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
