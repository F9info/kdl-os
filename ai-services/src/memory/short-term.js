import { redis } from '../config/redis.js';

const DEFAULT_TTL = 3600;

export async function setMemory(sessionId, key, value, ttl = DEFAULT_TTL) {
  await redis.set(`mem:short:${sessionId}:${key}`, JSON.stringify(value), 'EX', ttl);
}

export async function getMemory(sessionId, key) {
  const raw = await redis.get(`mem:short:${sessionId}:${key}`);
  return raw ? JSON.parse(raw) : null;
}

export async function deleteMemory(sessionId, key) {
  await redis.del(`mem:short:${sessionId}:${key}`);
}

export async function clearSessionMemory(sessionId) {
  const keys = await redis.keys(`mem:short:${sessionId}:*`);
  if (keys.length > 0) await redis.del(keys);
}
