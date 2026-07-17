import { Router } from 'express';
import crypto from 'node:crypto';
import { moduleGate } from '../../middleware/module-gate.js';
import { authenticate, createAuthenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { errorResponse, successResponse } from '../../shared/utils/response.js';
import {
  idParamSchema,
  updatePreferencesSchema,
  createTemplateSchema,
  updateTemplateSchema,
  previewTemplateSchema,
  createCategorySchema,
  updateCategorySchema,
  broadcastSchema,
} from './schema.js';

// ─── SSE auth ─────────────────────────────────────────────────────────────────
// EventSource cannot set headers and a JWT in the query string leaks into
// access logs, proxies, and browser history (KDL-270 M5). Flow: the client
// POSTs /stream/ticket with its normal Bearer auth, gets a single-use
// short-lived random ticket, and opens /stream?ticket=<t>. A Bearer header is
// still accepted for non-browser clients.

const SSE_TICKET_PREFIX = 'notif:sse:ticket:';
const SSE_TICKET_TTL_SECONDS = 60;

async function issueSseTicket(req, res, next) {
  try {
    const ticket = crypto.randomBytes(32).toString('hex');
    await redis.set(`${SSE_TICKET_PREFIX}${ticket}`, req.user.id, 'EX', SSE_TICKET_TTL_SECONDS);
    return successResponse(res, { ticket, expires_in: SSE_TICKET_TTL_SECONDS });
  } catch (err) {
    return next(err);
  }
}

// Bearer path shares the full authenticate pipeline — including the forced-
// password-change gate (KDL-283) — so the stream is never reachable on seeded
// credentials.
const authenticateSSEBearer = createAuthenticate();

async function authenticateSSE(req, res, next) {
  if (req.headers.authorization?.startsWith('Bearer ')) {
    return authenticateSSEBearer(req, res, next);
  }

  try {
    const ticket = typeof req.query.ticket === 'string' ? req.query.ticket : null;
    if (!ticket || !/^[a-f0-9]{64}$/.test(ticket)) {
      return errorResponse(res, 'No credentials provided', 401);
    }

    // Single-use: consume atomically so a leaked/logged ticket cannot be replayed.
    const userId = await redis.getdel(`${SSE_TICKET_PREFIX}${ticket}`);
    if (!userId) return errorResponse(res, 'Invalid or expired ticket', 401);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deleted_at: true, must_change_password: true },
    });
    if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
      return errorResponse(res, 'Account is inactive', 403);
    }

    // Ticket issuance is already gated by authenticate, but the flag can flip
    // between issuance and use — enforce the KDL-283 gate here too.
    if (user.must_change_password) {
      return errorResponse(res, 'Password change required', 403, {
        code: 'PASSWORD_CHANGE_REQUIRED',
      });
    }

    req.user = { userId: user.id, id: user.id, status: user.status };
    return next();
  } catch (err) {
    return next(err);
  }
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

// ─── SSE (before param routes to avoid clash with /:id) ──────────────────────
router.post('/stream/ticket', authenticate, issueSseTicket);
router.get('/stream', authenticateSSE, sseStream);

// ─── User-facing: own notifications ──────────────────────────────────────────
router.get('/', authenticate, listOwnNotifications);
router.get('/unread-count', authenticate, getUnreadCount);
router.post('/read-all', authenticate, markAllRead);
router.patch('/:id/read', authenticate, validate(idParamSchema), markOneRead);
router.delete('/:id', authenticate, validate(idParamSchema), deleteOwnNotification);

// ─── Preferences ─────────────────────────────────────────────────────────────
router.get('/preferences', authenticate, getOwnPreferences);
router.put('/preferences', authenticate, validate(updatePreferencesSchema), updateOwnPreferences);

// ─── Admin: categories ────────────────────────────────────────────────────────
router.get('/categories', authenticate, requirePermission('notifications', 'view'), listCategories);
router.post('/categories', authenticate, requirePermission('notifications', 'add'), validate(createCategorySchema), createCategory);
router.patch('/categories/:id', authenticate, requirePermission('notifications', 'edit'), validate(updateCategorySchema), updateCategory);

// ─── Admin: templates ─────────────────────────────────────────────────────────
router.get('/templates', authenticate, requirePermission('notifications', 'view'), listTemplates);
router.post('/templates', authenticate, requirePermission('notifications', 'add'), validate(createTemplateSchema), createTemplate);
router.patch('/templates/:id', authenticate, requirePermission('notifications', 'edit'), validate(updateTemplateSchema), updateTemplate);
router.delete('/templates/:id', authenticate, requirePermission('notifications', 'delete'), deleteTemplate);
router.post('/templates/:id/preview', authenticate, requirePermission('notifications', 'view'), validate(previewTemplateSchema), previewTemplate);

// ─── Admin: broadcast ─────────────────────────────────────────────────────────
router.post('/broadcast', authenticate, requirePermission('notifications', 'publish'), validate(broadcastSchema), broadcast);

export default router;
