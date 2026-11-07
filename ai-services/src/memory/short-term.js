import { redis } from '../config/redis.js';

const DEFAULT_TTL = 3600;

// Keys are {tenant}:{session}:{key}. A session id chosen by a caller can no longer reach another tenant's data.
const scope = (tenantId, sessionId) => {
  if (!tenantId) throw new Error('tenantId is required for short-term memory');
  return `mem:short:${tenantId}:${sessionId}`;
};

export async function setMemory(tenantId, sessionId, key, value, ttl = DEFAULT_TTL) {
  await redis.set(`${scope(tenantId, sessionId)}:${key}`, JSON.stringify(value), 'EX', ttl);
}

export async function getMemory(tenantId, sessionId, key) {
  const raw = await redis.get(`${scope(tenantId, sessionId)}:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteMemory(tenantId, sessionId, key) {
  await redis.del(`${scope(tenantId, sessionId)}:${key}`);
}

export async function clearSessionMemory(tenantId, sessionId) {
  let cursor = '0';
  do {
    const [next, keys] = await redis.scan(cursor, 'MATCH', `${scope(tenantId, sessionId)}:*`, 'COUNT', 100);
    cursor = next;
    if (keys.length > 0) await redis.del(keys);
  } while (cursor !== '0');
}
