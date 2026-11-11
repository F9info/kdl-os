import { Queue } from 'bullmq';
import { redis } from '../../../config/redis.js';

export const COMM_QUEUE = 'membership-comm';

// One queue, two job kinds: `expand` (event -> one row + one job per channel) and `deliver` (one channel).
export const commQueue = new Queue(COMM_QUEUE, {
  connection: redis,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 60_000 }, removeOnComplete: { count: 500 }, removeOnFail: { count: 1000 } },
});
