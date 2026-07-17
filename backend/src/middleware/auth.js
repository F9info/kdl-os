import jwt from 'jsonwebtoken';
import { errorResponse } from '../shared/utils/response.js';
import { prisma } from '../config/database.js';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '../config/jwt.js';

const JWT_VERIFY_OPTS = { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE };

const bearerToken = (req) =>
  req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;

// Named function expression: route-introspection tests (and stack traces)
// identify the middleware by fn.name === 'authenticate'.
export const createAuthenticate = ({ allowPendingPasswordChange = false, getToken = bearerToken } = {}) =>
  async function authenticate(req, res, next) {
    const token = getToken(req);
    if (!token) {
      return errorResponse(res, 'No token provided', 401);
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS);
      // H1: reject refresh tokens presented in place of access tokens
      if (payload.type !== 'access') {
        return errorResponse(res, 'Invalid token type', 401);
      }
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, status: true, deleted_at: true, must_change_password: true },
      });

      if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
        return errorResponse(res, 'Account is inactive', 403);
      }

      // A pending forced password change blocks every endpoint except the
      // password-change route itself (KDL-283) — a stolen seeded credential
      // cannot browse the app before the password is rotated.
      if (user.must_change_password && !allowPendingPasswordChange) {
        return errorResponse(res, 'Password change required', 403, {
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }

      req.user = { ...payload, id: user.id, status: user.status };
      next();
    } catch {
      return errorResponse(res, 'Invalid or expired token', 401);
    }
  };

export const authenticate = createAuthenticate();

// Only for the password-change endpoint: lets a user with a pending forced
// password change authenticate so they can actually set a new password.
export const authenticateAllowPendingPasswordChange = createAuthenticate({
  allowPendingPasswordChange: true,
});

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET, JWT_VERIFY_OPTS);
      if (payload.type === 'access') {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, status: true, deleted_at: true, must_change_password: true },
        });
        if (user && user.status !== 'SUSPENDED' && !user.deleted_at && !user.must_change_password) {
          req.user = { ...payload, id: user.id, status: user.status };
        }
      }
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
};
