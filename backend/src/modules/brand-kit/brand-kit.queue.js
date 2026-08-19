// Scheduled sweep: delete expired SVG originals (D-BK-5 retention contract).
// Mirrors the media.expiry.worker pattern — a daily BullMQ repeatable job.

import { redis } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';

const QUEUE_NAME = 'brand-kit-expiry';
const JOB_KEY = 'brand-kit-originals-expiry-daily';

export async function startBrandKitExpiryJob() {
  if (process.env.NODE_ENV === 'test') {
    logger.warn('Brand-kit expiry job not started: NODE_ENV=test');
    return null;
  }

  const { Queue: BullQueue, Worker } = await import('bullmq');
  const { default: Redis } = await import('ioredis');

  const workerConn = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const expiryQueue = new BullQueue(QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  });

  await expiryQueue.add(JOB_KEY, {}, {
    repeat: { pattern: '0 3 * * *' }, // 3 AM daily
    jobId: JOB_KEY,
  });

  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`Brand-kit expiry job ${job.id}: starting`);
      const { deleteExpiredOriginals } = await import('./service.js');
      const count = await deleteExpiredOriginals();
      logger.info(`Brand-kit expiry job ${job.id}: deleted ${count} expired original(s)`);
    },
    { connection: workerConn },
  );

  worker.on('failed', (job, e) => {
    logger.error(`Brand-kit expiry job ${job?.id} failed: ${e.message}`);
  });
  worker.on('error', (e) => {
    logger.error(`Brand-kit expiry worker error: ${e.message}`);
  });

  logger.info('Brand-kit originals expiry job scheduled (daily 03:00)');
  return worker;
}
