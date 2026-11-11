import { Worker } from 'bullmq';
import { redis } from '../../../config/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import { COMM_QUEUE, commQueue } from './queue.js';
import { deliverLog, expandEvent, expandInternal } from './dispatch.js';
import { runDailyReminders } from './reminders.js';

let worker = null;

async function handle(job) {
  switch (job.name) {
    case 'internal':
      return expandInternal(job.data);
    case 'expand':
      return expandEvent(job.data);
    case 'deliver':
      return deliverLog(job.data, { attemptsMade: job.attemptsMade, maxAttempts: job.opts?.attempts ?? 3 });
    case 'daily':
      return runDailyReminders();
    default:
      logger.warn(`membership comm worker: unknown job ${job.name}`);
  }
}

/** Idempotent. Called once when the membership routes load (never under test). */
export async function startCommWorker() {
  if (worker || process.env.NODE_ENV === 'test') return;
  worker = new Worker(COMM_QUEUE, handle, { connection: redis.duplicate({ maxRetriesPerRequest: null }), concurrency: 5 });
  worker.on('failed', (job, err) => logger.error(`membership comm job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => logger.error(`membership comm worker error: ${err.message}`));
  const { scheduleReminders } = await import('./reminders.js');
  await scheduleReminders(commQueue).catch((e) => logger.error(`membership reminders schedule failed: ${e.message}`));
}
