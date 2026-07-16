import jwt from 'jsonwebtoken';
import { errorResponse } from '../shared/utils/response.js';
import { prisma } from '../config/database.js';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } from '../config/jwt.js';

const JWT_VERIFY_OPTS = { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_AUDIENCE };

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(res, 'No token provided', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET, JWT_VERIFY_OPTS);
    // H1: reject refresh tokens presented in place of access tokens
    if (payload.type !== 'access') {
      return errorResponse(res, 'Invalid token type', 401);
    }
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, status: true, deleted_at: true },
    });

    if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
      return errorResponse(res, 'Account is inactive', 403);
    }

    req.user = { ...payload, id: user.id, status: user.status };
    next();
  } catch {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET, JWT_VERIFY_OPTS);
      if (payload.type === 'access') {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { id: true, status: true, deleted_at: true },
        });
        if (user && user.status !== 'SUSPENDED' && !user.deleted_at) {
          req.user = { ...payload, id: user.id, status: user.status };
        }
      }
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
};
