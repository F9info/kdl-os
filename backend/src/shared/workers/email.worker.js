import { Worker } from 'bullmq';
import { redis } from '../../config/redis.js';
import { sendEmail } from '../services/email.service.js';
import { logger } from '../utils/logger.js';

export const emailWorker = new Worker(
  'email',
  async (job) => {
    const { to, subject, html } = job.data;
    await sendEmail(to, subject, html);
    logger.info(`Email sent to ${to} (job ${job.id})`);
  },
  { connection: redis }
);

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed: ${err.message}`);
});
