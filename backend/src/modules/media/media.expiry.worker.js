import { redis } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';
import { runExpiryJob } from './workflow.service.js';

const EXPIRY_QUEUE_NAME = 'media-expiry';
const EXPIRY_JOB_KEY = 'media-expiry-daily';

/**
 * Register a BullMQ repeatable job that marks published-but-past-expiry media
 * as EXPIRED.  Mirrors the notifications retention-job pattern.
 */
export async function startExpiryJob() {
  if (process.env.NODE_ENV === 'test') {
    logger.warn('Media expiry job not started: NODE_ENV=test');
    return null;
  }

  const { Queue: BullQueue, Worker } = await import('bullmq');
  const { default: Redis } = await import('ioredis');

  const workerConn = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  const expiryQueue = new BullQueue(EXPIRY_QUEUE_NAME, {
    connection: redis,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 60_000 },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 20 },
    },
  });

  await expiryQueue.add(
    EXPIRY_JOB_KEY,
    {},
    {
      repeat: { pattern: '0 2 * * *' }, // 2 AM daily
      jobId: EXPIRY_JOB_KEY,
    }
  );

  const expiryWorker = new Worker(
    EXPIRY_QUEUE_NAME,
    async (job) => {
      logger.info(`Media expiry job ${job.id}: starting`);
      const count = await runExpiryJob();
      logger.info(`Media expiry job ${job.id}: marked ${count} item(s) as EXPIRED`);
    },
    { connection: workerConn }
  );

  expiryWorker.on('failed', (job, err) => {
    logger.error(`Media expiry job ${job?.id} failed: ${err.message}`);
  });
  expiryWorker.on('error', (err) => {
    logger.error(`Media expiry worker error: ${err.message}`);
  });

  logger.info('Media expiry job scheduled (daily 02:00)');
  return expiryWorker;
}
