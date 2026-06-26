import { redis } from '../config/redis.js';

const CTX_TTL = 3600;

const ctxKey = (sessionId) => `context:${sessionId}`;

export async function addMessage(sessionId, role, content) {
  const key = ctxKey(sessionId);
  const raw = await redis.get(key);
  const messages = raw ? JSON.parse(raw) : [];
  messages.push({ role, content, ts: Date.now() });
  // Keep last 50 messages to prevent runaway context growth
  if (messages.length > 50) messages.splice(0, messages.length - 50);
  await redis.set(key, JSON.stringify(messages), 'EX', CTX_TTL);
}

export async function getContext(sessionId) {
  const raw = await redis.get(ctxKey(sessionId));
  return raw ? JSON.parse(raw) : [];
}

export async function clearContext(sessionId) {
  await redis.del(ctxKey(sessionId));
}
