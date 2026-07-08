import { Queue } from 'bullmq';
import { redis } from '../../config/redis.js';

export const mediaQueue = new Queue('media', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const enqueueVariantJob = (mediaId, path, mimeType) =>
  mediaQueue.add('generate-variants', { mediaId, path, mimeType });

// action: 'index' (add/update doc) | 'remove' (drop doc)
export const enqueueSearchIndexJob = (mediaId, action = 'index') =>
  mediaQueue.add('search-index', { mediaId, action });
