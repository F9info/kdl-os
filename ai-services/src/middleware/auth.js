import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

// Origins allowed to make cookie-authenticated calls (CSRF defense).
const ALLOWED_ORIGINS = new Set(
  [
    ...(process.env.CORS_ORIGIN ?? '').split(','),
    ...(process.env.FRONTEND_URL ?? '').split(','),
  ].map((o) => o.trim()).filter(Boolean),
);

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const headerToken = header?.startsWith('Bearer ') ? header.slice(7) : null;
    const cookieToken = req.cookies?.['kdl-auth-token'] ?? null;
    const token = headerToken ?? cookieToken;

    if (!token) return errorResponse(res, 'Unauthorized', 401);

    // Cookie-based auth is CSRF-able (the browser attaches it automatically),
    // so cookie calls must prove same-app origin. Bearer-header calls are
    // exempt — an attacker's page cannot set the Authorization header.
    if (!headerToken) {
      const origin = req.headers.origin;
      if (!origin || !ALLOWED_ORIGINS.has(origin)) {
        return errorResponse(res, 'Cross-origin cookie authentication rejected', 403);
      }
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = payload;
    next();
  } catch {
    return errorResponse(res, 'Unauthorized', 401);
  }
}
