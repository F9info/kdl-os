import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';
import { notificationsQueue } from './notifications.queue.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

const CHUNK_SIZE = 500;
const QUEUE_THRESHOLD = 50;
const HEAVY_CHANNELS = new Set(['EMAIL', 'SMS', 'WHATSAPP']);
const SECURITY_CATEGORY = 'security';

// ─── Template rendering ───────────────────────────────────────────────────────

/**
 * Replace {{var}} placeholders in text with values from data.
 * Missing vars resolve to '' — never throws.
 */
export function renderTemplate(text, data = {}) {
  if (!text) return text ?? '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) {
      logger.debug(`Notification template: missing variable "{{${key}}}" — rendered as blank`);
      return '';
    }
    return String(val);
  });
}

/**
 * Fetch a NotificationTemplate by slug (with its category).
 */
export async function getNotificationTemplate(slug) {
  return prisma.notificationTemplate.findUnique({
    where: { slug },
    include: { category: true },
  });
}

// ─── Strip dangerous HTML (minimum: remove script tags) ──────────────────────

export function stripScripts(html) {
  if (!html) return html ?? '';
  return html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

// ─── Recipient resolution ─────────────────────────────────────────────────────

async function resolveUserIds(to) {
  if (to.user_ids) {
    return to.user_ids;
  }

  if (to.role_slug) {
    const role = await prisma.rbacRole.findUnique({
      where: { slug: to.role_slug },
      select: { id: true },
    });
    if (!role) return [];
    const assignments = await prisma.userRole.findMany({
      where: { role_id: role.id },
      select: { user_id: true },
    });
    return assignments.map((a) => a.user_id);
  }

  if (to.all) {
    const users = await prisma.user.findMany({
      where: { deleted_at: null },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  return [];
}

// ─── Preference filtering ─────────────────────────────────────────────────────

/**
 * Returns Set of user IDs who have NOT disabled this channel for the given category.
 * Security category bypasses preference check for IN_APP channel.
 */
export async function filterByPreference(userIds, categorySlug, channel) {
  // Security category: always deliver IN_APP
  if (categorySlug === SECURITY_CATEGORY && channel === 'IN_APP') {
    return new Set(userIds);
  }

  // Find the category id
  const category = await prisma.notificationCategory.findUnique({
    where: { slug: categorySlug },
    select: { id: true },
  });
  if (!category) return new Set(userIds);

  // Find users who explicitly disabled this channel
  const disabledPrefs = await prisma.notificationPreference.findMany({
    where: {
      user_id: { in: userIds },
      category_id: category.id,
      channel,
      enabled: false,
    },
    select: { user_id: true },
  });

  const disabledSet = new Set(disabledPrefs.map((p) => p.user_id));
  return new Set(userIds.filter((id) => !disabledSet.has(id)));
}

// ─── Core processing logic (used inline and by worker) ───────────────────────

/**
 * Process a notify batch synchronously (called inline or from worker).
 */
export async function processBatch({
  userIds,
  categorySlug,
  title,
  body,
  emailSubject,
  emailBody,
  smsBody,
  whatsappBody,
  data,
  channels,
  actor_id,
}) {
  let integrationsDisabledLogged = false;

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);

    // ── IN_APP ────────────────────────────────────────────────────────────────
    if (channels.includes('IN_APP') && body) {
      const eligible = await filterByPreference(chunk, categorySlug, 'IN_APP');
      if (eligible.size > 0) {
        const rows = Array.from(eligible).map((userId) => ({
          user_id: userId,
          category_slug: categorySlug,
          title,
          body,
          data: data ?? undefined,
        }));

        await prisma.notification.createMany({ data: rows, skipDuplicates: false });

        // Fetch created rows to get IDs and timestamps for Redis publish
        const created = await prisma.notification.findMany({
          where: {
            user_id: { in: Array.from(eligible) },
            created_at: { gte: new Date(Date.now() - 5000) },
            body,
          },
          select: { id: true, user_id: true, title: true, body: true, data: true, created_at: true },
          orderBy: { created_at: 'desc' },
          take: rows.length,
        });

        for (const notif of created) {
          const payload = {
            id: notif.id,
            title: notif.title,
            body: notif.body,
            data: notif.data,
            created_at: notif.created_at,
          };
          await redis
            .publish(`notif:user:${notif.user_id}`, JSON.stringify(payload))
            .catch((err) => logger.warn(`Redis publish failed for user ${notif.user_id}: ${err.message}`));
        }
      }
    }

    // ── EMAIL / SMS / WHATSAPP ────────────────────────────────────────────────
    for (const channel of channels) {
      if (!HEAVY_CHANNELS.has(channel)) continue;

      let to_field_getter;
      let channelBody;
      let channelSubject;

      if (channel === 'EMAIL') {
        channelBody = stripScripts(emailBody);
        channelSubject = emailSubject;
        to_field_getter = async (userId) => {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
          return user?.email;
        };
      } else if (channel === 'SMS') {
        channelBody = smsBody;
        to_field_getter = async (userId) => {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
          return user?.phone;
        };
      } else if (channel === 'WHATSAPP') {
        channelBody = whatsappBody;
        to_field_getter = async (userId) => {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
          return user?.phone;
        };
      }

      if (!channelBody) continue;

      const eligible = await filterByPreference(chunk, categorySlug, channel);
      if (eligible.size === 0) continue;

      // Lazy import integrations service to avoid circular or hard dependency
      let dispatchMessage;
      let IntegrationsDisabledError;
      try {
        const mod = await import('../integrations/service.js');
        dispatchMessage = mod.dispatchMessage;
        IntegrationsDisabledError = mod.IntegrationsDisabledError;
      } catch (importErr) {
        logger.warn(`Notifications: could not import integrations service: ${importErr.message}`);
        continue;
      }

      for (const userId of eligible) {
        try {
          const to = await to_field_getter(userId);
          if (!to) continue;
          await dispatchMessage({
            channel,
            to,
            subject: channelSubject ?? title,
            body: channelBody,
            source: 'notifications',
            meta: { user_id: userId, category: categorySlug },
          });
        } catch (err) {
          if (IntegrationsDisabledError && err instanceof IntegrationsDisabledError) {
            if (!integrationsDisabledLogged) {
              integrationsDisabledLogged = true;
              writeActivityAsync({
                actor: actor_id ?? 'system',
                module: 'notifications',
                action: 'skip',
                description: `External channel ${channel} skipped — integrations module disabled`,
              }).catch(() => {});
            }
            break; // no point trying more users for this channel
          }
          logger.error(`Notifications: failed to dispatch ${channel} to user ${userId}: ${err.message}`);
        }
      }
    }
  }
}

// ─── Public notify() API ──────────────────────────────────────────────────────

/**
 * Send notifications to one or more recipients.
 *
 * @param {object} opts
 * @param {{ user_ids?: string[], role_slug?: string, all?: boolean }} opts.to
 * @param {string} [opts.template]   - template slug
 * @param {{ title: string, body: string }} [opts.inline]
 * @param {object} [opts.data]       - template variable values + click-through url
 * @param {string[]} [opts.channels] - default ['IN_APP']
 * @param {string} [opts.actor_id]
 */
export async function notify({
  to,
  template,
  inline,
  data = {},
  channels = ['IN_APP'],
  actor_id,
}) {
  // 1. Resolve recipients
  const userIds = await resolveUserIds(to);
  if (userIds.length === 0) return { sent: 0 };

  // 2. Resolve template
  let categorySlug = 'system';
  let title = inline?.title ?? '';
  let inAppBody = inline?.body ?? '';
  let emailSubject = null;
  let emailBody = null;
  let smsBody = null;
  let whatsappBody = null;

  if (template) {
    const tpl = await getNotificationTemplate(template);
    if (!tpl) throw new Error(`Notification template not found: ${template}`);
    categorySlug = tpl.category?.slug ?? 'system';
    title = renderTemplate(tpl.email_subject ?? tpl.in_app_body ?? '', data);
    inAppBody = renderTemplate(tpl.in_app_body ?? '', data);
    emailSubject = tpl.email_subject ? renderTemplate(tpl.email_subject, data) : null;
    emailBody = tpl.email_body ? renderTemplate(tpl.email_body, data) : null;
    smsBody = tpl.sms_body ? renderTemplate(tpl.sms_body, data) : null;
    whatsappBody = tpl.whatsapp_body ? renderTemplate(tpl.whatsapp_body, data) : null;
  } else if (inline) {
    title = renderTemplate(inline.title, data);
    inAppBody = renderTemplate(inline.body, data);
  }

  const hasHeavyChannel = channels.some((ch) => HEAVY_CHANNELS.has(ch));
  const shouldQueue = userIds.length > QUEUE_THRESHOLD || hasHeavyChannel;

  const jobPayload = {
    userIds,
    categorySlug,
    title,
    body: inAppBody,
    emailSubject,
    emailBody,
    smsBody,
    whatsappBody,
    data,
    channels,
    actor_id,
  };

  // 3. Queue if threshold exceeded or heavy channel
  if (shouldQueue) {
    const job = await notificationsQueue.add('notify-batch', jobPayload);
    return { batch_id: job.id, recipient_count: userIds.length };
  }

  // 4. Process inline
  await processBatch(jobPayload);
  return { sent: userIds.length };
}

// ─── Retention job ────────────────────────────────────────────────────────────

const RETENTION_QUEUE_NAME = 'notifications-retention';
const RETENTION_JOB_KEY = 'retention-daily';

/**
 * Start the 24-hour repeatable retention job.
 * Creates its own queue on the shared redis connection.
 */
export async function startRetentionJob() {
  const { Queue: BullQueue } = await import('bullmq');
  const retentionQueue = new BullQueue(RETENTION_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  });

  await retentionQueue.add(
    RETENTION_JOB_KEY,
    {},
    {
      repeat: { pattern: '0 3 * * *' }, // 3 AM daily
      jobId: RETENTION_JOB_KEY,
    }
  );

  logger.info('Notifications: retention job scheduled (daily 03:00)');
}
