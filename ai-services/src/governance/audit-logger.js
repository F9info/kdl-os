import { redis } from '../config/redis.js';

const AUDIT_KEY = 'ai:audit:log';
const MAX_ENTRIES = 1000;

export async function auditLogger({ model, priority, input_tokens, output_tokens, cost_estimate, session_id = null }) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    model,
    priority,
    input_tokens,
    output_tokens,
    cost_estimate,
    session_id,
  });

  const pipeline = redis.multi();
  pipeline.lpush(AUDIT_KEY, entry);
  pipeline.ltrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  await pipeline.exec();
}

export async function getAuditLog(limit = 100) {
  const entries = await redis.lrange(AUDIT_KEY, 0, limit - 1);
  return entries.map((e) => JSON.parse(e));
}
