import { redis } from '../config/redis.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('audit');

const AUDIT_KEY = 'ai:audit:log';
const MAX_ENTRIES = 1000;

export async function auditLogger({ model, priority, input_tokens, output_tokens, cost_estimate, session_id = null, actor = null, tenant = null, event = null, meta = null }) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    model,
    priority,
    input_tokens,
    output_tokens,
    cost_estimate,
    session_id,
    actor,
    tenant,
    // Additive (KDL-510): envelope-level records tag themselves (e.g.
    // 'brand.inference') so credits can reconcile per-generation rows apart
    // from the per-call rows brainRouter writes.
    ...(event ? { event } : {}),
    ...(meta ? { meta } : {}),
  });

  // The Redis list is a short window (last 1000) and is lost with Redis. Every record is also written
  // to stdout, where the container log driver keeps it for as long as the deployment retains logs.
  log.info(entry);

  const pipeline = redis.multi();
  pipeline.lpush(AUDIT_KEY, entry);
  pipeline.ltrim(AUDIT_KEY, 0, MAX_ENTRIES - 1);
  await pipeline.exec();
}

export async function getAuditLog(limit = 100) {
  const entries = await redis.lrange(AUDIT_KEY, 0, limit - 1);
  return entries.map((e) => JSON.parse(e));
}
