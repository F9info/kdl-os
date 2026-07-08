import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from '../../config/database.js';
import { logger } from '../../shared/utils/logger.js';
import { processBatch } from './service.js';

const DEFAULT_RETENTION_DAYS = 90;
const RETENTION_QUEUE_NAME = 'notifications-retention';

// ─── Job handlers ─────────────────────────────────────────────────────────────

async function processNotifyBatch(job) {
  const {
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
  } = job.data;

  logger.info(`Notifications worker: processing batch job ${job.id} for ${userIds?.length ?? 0} recipients`);

  await processBatch({
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
  });

  logger.info(`Notifications worker: completed batch job ${job.id}`);
}

async function processRetention(job) {
  logger.info(`Notifications retention: starting cleanup job ${job.id}`);

  const setting = await prisma.appSetting
    .findUnique({ where: { key: 'notifications.retention_days' }, select: { value: true } })
    .catch(() => null);
  const retentionDays = setting ? (parseInt(setting.value, 10) || DEFAULT_RETENTION_DAYS) : DEFAULT_RETENTION_DAYS;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await prisma.notification.deleteMany({
    where: {
      read_at: { not: null },
      created_at: { lt: cutoff },
    },
  });

  logger.info(`Notifications retention: deleted ${result.count} old read notifications (cutoff: ${cutoff.toISOString()})`);
}

// ─── Worker factory ───────────────────────────────────────────────────────────

function makeWorkerConnection() {
  return new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function jobHandler(job) {
  switch (job.name) {
    case 'notify-batch':
      return processNotifyBatch(job);
    case 'retention':
      return processRetention(job);
    default:
      logger.warn(`Notifications worker: unknown job name "${job.name}" (id: ${job.id})`);
  }
}

async function retentionJobHandler(job) {
  return processRetention(job);
}

// ─── Worker + retention worker instantiation ──────────────────────────────────

export const notificationsWorker =
  process.env.NODE_ENV !== 'test'
    ? new Worker('notifications', jobHandler, { connection: makeWorkerConnection() })
    : null;

export const notificationsRetentionWorker =
  process.env.NODE_ENV !== 'test'
    ? new Worker(RETENTION_QUEUE_NAME, retentionJobHandler, { connection: makeWorkerConnection() })
    : null;

if (notificationsWorker) {
  notificationsWorker.on('failed', (job, err) => {
    logger.error(`Notifications job ${job?.id} permanently failed: ${err.message}`);
  });
  notificationsWorker.on('error', (err) => {
    logger.error(`Notifications worker error: ${err.message}`);
  });
} else {
  logger.warn('Notifications worker not started: NODE_ENV=test');
}

if (notificationsRetentionWorker) {
  notificationsRetentionWorker.on('failed', (job, err) => {
    logger.error(`Notifications retention job ${job?.id} permanently failed: ${err.message}`);
  });
  notificationsRetentionWorker.on('error', (err) => {
    logger.error(`Notifications retention worker error: ${err.message}`);
  });
}

// ─── Retention job registration ───────────────────────────────────────────────

export { startRetentionJob } from './service.js';
