import { Queue } from 'bullmq';
import { redis } from '../../config/redis.js';

export const integrationsQueue = new Queue('integrations', {
  connection: redis,
  defaultJobOptions: {
    attempts: 4,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});
