import { Queue, Worker, QueueEvents } from 'bullmq';
import { redis } from '../../config/redis.js';
import { logger } from '../../shared/utils/logger.js';

const QUEUE_NAME = 'media-processing';
const CONCURRENCY = 2;
const JOB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

export const processingQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

export const processingQueueEvents = new QueueEvents(QUEUE_NAME, { connection: redis });

let processingWorker;

export const startProcessingWorker = () => {
  processingWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      logger.info(`Processing job ${job.id} type=${job.name}`);

      // Dynamically dispatch to the correct handler
      const { executeProcessingJob } = await import('./processing.service.js');
      return executeProcessingJob(job);
    },
    {
      connection: redis,
      concurrency: CONCURRENCY,
      lockDuration: JOB_TIMEOUT_MS,
    }
  );

  processingWorker.on('completed', (job) =>
    logger.info(`Processing job ${job.id} completed`)
  );

  processingWorker.on('failed', (job, err) =>
    logger.error(`Processing job ${job?.id} failed: ${err.message}`)
  );

  return processingWorker;
};

export const closeProcessingWorker = async () => {
  if (processingWorker) await processingWorker.close();
};

export const enqueueProcessingJob = (type, data) =>
  processingQueue.add(type, data, { jobId: undefined });

export const getProcessingWorker = () => processingWorker;
