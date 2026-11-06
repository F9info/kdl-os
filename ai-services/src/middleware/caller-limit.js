import rateLimit from 'express-rate-limit';
import { errorResponse } from '../utils/response.js';

// Per-caller (not per-IP) limits: behind nginx / the backend every user shares an IP, and the
// global 100/15min IP limiter cannot tell one user from another. Mount AFTER authenticate.
// ponytail: in-memory store, so counts are per instance and reset on restart; swap in a Redis
// store (rate-limit-redis) if ai-services is ever scaled out.
export const callerId = (req) => req.user?.userId ?? req.user?.sub ?? req.user?.id ?? 'anonymous';

/** name: env override key AI_LIMIT_<NAME> (requests per 15 min per caller). */
export const callerLimit = (name, defaultMax) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: () => Number(process.env[`AI_LIMIT_${name.toUpperCase()}`]) || defaultMax,
    keyGenerator: callerId,
    standardHeaders: true,
    legacyHeaders: false,
    validate: { keyGeneratorIpFallback: false },
    handler: (_req, res) => errorResponse(res, 'Too many AI requests. Try again later.', 429),
  });

/**
 * Role gate. Service JWTs (signed by our backend: { service: true }) pass when `service` is set;
 * user JWTs pass when they hold one of `roles` (slugs, as in the access-token payload).
 */
export const allow = ({ service = false, roles = [] } = {}) =>
  (req, res, next) => {
    if (service && req.user?.service === true) return next();
    if ((req.user?.roles ?? []).some((r) => roles.includes(r))) return next();
    return errorResponse(res, 'Forbidden', 403);
  };
