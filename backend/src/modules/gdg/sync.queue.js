// Scheduled chapter sync: every 6 hours, each project with auto sync on pulls its chapter's events.
// A polite interval for an undocumented public API; admins can always press "Sync now".
import { Queue, Worker } from 'bullmq';
import { redis } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';
import { runAutoSyncs } from './service.js';

const QUEUE = 'gdg-chapter-sync';
const JOB_KEY = 'chapter-sync-6h';

let worker = null;

export async function startChapterSyncJob() {
  const queue = new Queue(QUEUE, {
    connection: redis,
    defaultJobOptions: { attempts: 1, removeOnComplete: { count: 10 }, removeOnFail: { count: 20 } },
  });
  await queue.add(JOB_KEY, {}, { repeat: { pattern: '15 */6 * * *' }, jobId: JOB_KEY });
  worker = new Worker(
    QUEUE,
    async () => {
      const n = await runAutoSyncs();
      logger.info(`Events: chapter sync ran for ${n} project(s)`);
    },
    { connection: redis, concurrency: 1 }
  );
  worker.on('failed', (job, err) => logger.error(`Events: chapter sync job ${job?.id} failed: ${err.message}`));
  logger.info('Events: chapter sync scheduled (every 6 hours)');
}

export async function closeChapterSyncWorker() {
  if (worker) await worker.close();
}
