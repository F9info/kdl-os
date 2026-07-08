import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { notify, renderTemplate, getNotificationTemplate } from './service.js';

const SSE_MAX_CONNECTIONS = 3;
const SSE_HEARTBEAT_MS = 25_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

// ─── User-facing: own notifications ──────────────────────────────────────────

export const listOwnNotifications = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const unreadOnly = req.query.unread === 'true';

    const where = {
      user_id: req.user.id,
      ...(unreadOnly ? { read_at: null } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    successResponse(res, { items, total, page, limit });
  } catch (err) {
    next(err);
  }
};

export const getUnreadCount = async (req, res, next) => {
  try {
    const count = await prisma.notification.count({
      where: { user_id: req.user.id, read_at: null },
    });
    successResponse(res, { count });
  } catch (err) {
    next(err);
  }
};

export const markOneRead = async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({
      where: { id: req.params.id },
      select: { user_id: true, read_at: true },
    });

    if (!notif || notif.user_id !== req.user.id) {
      return errorResponse(res, 'Notification not found', 404);
    }

    const updated = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read_at: notif.read_at ?? new Date() },
    });

    successResponse(res, { notification: updated });
  } catch (err) {
    next(err);
  }
};

export const markAllRead = async (req, res, next) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { user_id: req.user.id, read_at: null },
      data: { read_at: new Date() },
    });

    successResponse(res, { updated: result.count });
  } catch (err) {
    next(err);
  }
};

export const deleteOwnNotification = async (req, res, next) => {
  try {
    const notif = await prisma.notification.findUnique({
      where: { id: req.params.id },
      select: { user_id: true },
    });

    if (!notif || notif.user_id !== req.user.id) {
      return errorResponse(res, 'Notification not found', 404);
    }

    await prisma.notification.delete({ where: { id: req.params.id } });
    successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};

// ─── Preferences ─────────────────────────────────────────────────────────────

export const getOwnPreferences = async (req, res, next) => {
  try {
    const categories = await prisma.notificationCategory.findMany({
      orderBy: { slug: 'asc' },
    });

    const existingPrefs = await prisma.notificationPreference.findMany({
      where: { user_id: req.user.id },
    });

    const prefMap = {};
    for (const p of existingPrefs) {
      prefMap[`${p.category_id}:${p.channel}`] = p.enabled;
    }

    const channels = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP'];
    const matrix = categories.map((cat) => ({
      category_id: cat.id,
      category_slug: cat.slug,
      category_name: cat.name,
      channels: channels.map((ch) => ({
        channel: ch,
        enabled: prefMap[`${cat.id}:${ch}`] ?? true,
      })),
    }));

    successResponse(res, { preferences: matrix });
  } catch (err) {
    next(err);
  }
};

export const updateOwnPreferences = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    if (!Array.isArray(preferences)) {
      return errorResponse(res, 'preferences must be an array', 400);
    }

    for (const pref of preferences) {
      await prisma.notificationPreference.upsert({
        where: {
          user_id_category_id_channel: {
            user_id: req.user.id,
            category_id: pref.category_id,
            channel: pref.channel,
          },
        },
        update: { enabled: pref.enabled },
        create: {
          user_id: req.user.id,
          category_id: pref.category_id,
          channel: pref.channel,
          enabled: pref.enabled,
        },
      });
    }

    successResponse(res, { updated: preferences.length });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: templates ─────────────────────────────────────────────────────────

export const listTemplates = async (req, res, next) => {
  try {
    const templates = await prisma.notificationTemplate.findMany({
      include: { category: true },
      orderBy: { slug: 'asc' },
    });
    successResponse(res, { templates });
  } catch (err) {
    next(err);
  }
};

export const createTemplate = async (req, res, next) => {
  try {
    const {
      slug,
      category_id,
      name,
      variables,
      in_app_body,
      email_subject,
      email_body,
      sms_body,
      whatsapp_body,
      is_active,
    } = req.body;

    const template = await prisma.notificationTemplate.create({
      data: {
        slug,
        category_id,
        name,
        variables: variables ?? [],
        in_app_body: in_app_body ?? null,
        email_subject: email_subject ?? null,
        email_body: email_body ?? null,
        sms_body: sms_body ?? null,
        whatsapp_body: whatsapp_body ?? null,
        is_active: is_active ?? true,
      },
      include: { category: true },
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'template_created',
      subject_type: 'NotificationTemplate',
      subject_id: template.id,
      description: `Template "${template.slug}" created`,
      ip_address: getClientIp(req),
    });

    successResponse(res, { template }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateTemplate = async (req, res, next) => {
  try {
    const template = await prisma.notificationTemplate.update({
      where: { id: req.params.id },
      data: req.body,
      include: { category: true },
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'template_updated',
      subject_type: 'NotificationTemplate',
      subject_id: template.id,
      description: `Template "${template.slug}" updated`,
      ip_address: getClientIp(req),
    });

    successResponse(res, { template });
  } catch (err) {
    next(err);
  }
};

export const deleteTemplate = async (req, res, next) => {
  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    });

    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    if (template.category?.is_system) {
      return errorResponse(res, 'Cannot delete templates belonging to a system category', 409);
    }

    await prisma.notificationTemplate.delete({ where: { id: req.params.id } });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'template_deleted',
      subject_type: 'NotificationTemplate',
      subject_id: template.id,
      description: `Template "${template.slug}" deleted`,
      ip_address: getClientIp(req),
    });

    successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};

export const previewTemplate = async (req, res, next) => {
  try {
    const template = await prisma.notificationTemplate.findUnique({
      where: { id: req.params.id },
    });

    if (!template) {
      return errorResponse(res, 'Template not found', 404);
    }

    const data = req.body.data ?? {};
    const preview = {
      in_app: template.in_app_body ? renderTemplate(template.in_app_body, data) : null,
      email_subject: template.email_subject ? renderTemplate(template.email_subject, data) : null,
      email_body: template.email_body ? renderTemplate(template.email_body, data) : null,
      sms: template.sms_body ? renderTemplate(template.sms_body, data) : null,
      whatsapp: template.whatsapp_body ? renderTemplate(template.whatsapp_body, data) : null,
    };

    successResponse(res, { preview });
  } catch (err) {
    next(err);
  }
};

// ─── Admin: broadcast ─────────────────────────────────────────────────────────

export const broadcast = async (req, res, next) => {
  try {
    const { to, template, inline, channels, data } = req.body;

    const targetCount = [to?.role_slug, to?.all].filter(Boolean).length;
    if (!to || targetCount !== 1) {
      return errorResponse(res, 'to must specify exactly one of: role_slug, all', 400);
    }

    if (!template && !inline) {
      return errorResponse(res, 'Either template or inline must be provided', 400);
    }

    const result = await notify({
      to,
      template,
      inline,
      channels: channels ?? ['IN_APP'],
      data: data ?? {},
      actor_id: req.user.id,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'broadcast',
      description: `Broadcast sent to ${to.role_slug ? `role:${to.role_slug}` : 'all users'} (${result.recipient_count ?? result.sent ?? 'queued'} recipients)`,
      properties: { to, template, channels, batch_id: result.batch_id },
      ip_address: getClientIp(req),
    });

    successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

// ─── Admin: categories ────────────────────────────────────────────────────────

export const listCategories = async (req, res, next) => {
  try {
    const categories = await prisma.notificationCategory.findMany({
      orderBy: { slug: 'asc' },
    });
    successResponse(res, { categories });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { slug, name, description } = req.body;
    const category = await prisma.notificationCategory.create({
      data: { slug, name, description: description ?? null },
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'category_created',
      subject_type: 'NotificationCategory',
      subject_id: category.id,
      description: `Category "${category.slug}" created`,
      ip_address: getClientIp(req),
    });

    successResponse(res, { category }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const existing = await prisma.notificationCategory.findUnique({
      where: { id: req.params.id },
      select: { is_system: true },
    });

    if (!existing) {
      return errorResponse(res, 'Category not found', 404);
    }

    // Prevent changing is_system field via API
    const { is_system: _ignore, ...safeData } = req.body;

    const category = await prisma.notificationCategory.update({
      where: { id: req.params.id },
      data: safeData,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'notifications',
      action: 'category_updated',
      subject_type: 'NotificationCategory',
      subject_id: category.id,
      description: `Category "${category.slug}" updated`,
      ip_address: getClientIp(req),
    });

    successResponse(res, { category });
  } catch (err) {
    next(err);
  }
};

// ─── SSE stream ───────────────────────────────────────────────────────────────

export const sseStream = async (req, res, next) => {
  const userId = req.user.id;
  const sseCountKey = `notif:sse:${userId}`;

  let subscriber = null;
  let heartbeat = null;
  let closed = false;

  const cleanup = async () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);

    if (subscriber) {
      try {
        await subscriber.unsubscribe(`notif:user:${userId}`);
        subscriber.disconnect();
      } catch {
        // best-effort cleanup
      }
    }

    // Decrement SSE counter
    try {
      const count = await redis.decr(sseCountKey);
      if (count <= 0) await redis.del(sseCountKey);
    } catch {
      // best-effort
    }
  };

  try {
    // Check / enforce SSE connection cap
    const currentCount = await redis.incr(sseCountKey);
    await redis.expire(sseCountKey, 3600); // 1h safety TTL

    if (currentCount > SSE_MAX_CONNECTIONS) {
      await redis.decr(sseCountKey);
      return errorResponse(res, 'Too many concurrent SSE connections', 429);
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Heartbeat comment every 25s
    heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        res.write(': heartbeat\n\n');
      }
    }, SSE_HEARTBEAT_MS);

    // Dedicated subscriber connection (ioredis requirement)
    subscriber = redis.duplicate();

    subscriber.on('error', (err) => {
      // Log but don't crash — client will reconnect via EventSource retry
    });

    await subscriber.subscribe(`notif:user:${userId}`);

    subscriber.on('message', (_channel, message) => {
      if (res.writableEnded) return;
      res.write(`event: notification\n`);
      res.write(`data: ${message}\n\n`);
    });

    // Handle client disconnect
    req.on('close', async () => {
      await cleanup();
    });

    req.on('aborted', async () => {
      await cleanup();
    });
  } catch (err) {
    await cleanup();
    next(err);
  }
};
