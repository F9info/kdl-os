import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';

const SENSITIVE_KEYS = /password|token|secret|hash|credential|auth/i;

function scrubProperties(value) {
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    return value.map((item) => scrubProperties(item));
  }

  if (typeof value === 'object') {
    const cleaned = {};
    for (const [key, val] of Object.entries(value)) {
      if (SENSITIVE_KEYS.test(key)) {
        cleaned[key] = '[REDACTED]';
      } else {
        cleaned[key] = scrubProperties(val);
      }
    }
    return cleaned;
  }

  return value;
}

export function getClientIp(req) {
  if (!req) return null;
  return (
    req.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

/**
 * Persist an activity/audit log entry.
 *
 * Properties are automatically scrubbed of obvious secrets/tokens before
 * persistence. Logging failure is swallowed and written to the app log —
 * it never propagates to the caller, so a logging outage cannot break the
 * request path.
 */
export async function writeActivity({
  actor,
  module,
  action,
  subject_type = null,
  subject_id = null,
  description,
  properties = null,
  ip_address = null,
  req = null,
}) {
  try {
    return await prisma.activityLog.create({
      data: {
        actor_id: actor ?? null,
        module,
        action,
        subject_type,
        subject_id,
        description,
        properties: scrubProperties(properties),
        ip_address: ip_address ?? getClientIp(req),
      },
    });
  } catch (err) {
    logger.error('Activity log write failed', {
      error: err.message,
      module,
      action,
    });
    return null;
  }
}

/**
 * Fire-and-forget variant of `writeActivity`.
 */
export function writeActivityAsync(payload) {
  return writeActivity(payload).catch(() => {
    // Error already logged inside writeActivity.
  });
}
