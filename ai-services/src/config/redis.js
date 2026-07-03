import Redis from 'ioredis';
import { createLogger } from '../utils/logger.js';

const log = createLogger('redis');

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6380', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('error', (err) => log.error('Error:', err.message));
