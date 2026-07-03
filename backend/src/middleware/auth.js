import jwt from 'jsonwebtoken';
import { errorResponse } from '../shared/utils/response.js';
import { prisma } from '../config/database.js';

export const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return errorResponse(res, 'No token provided', 401);
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, role: true, status: true, deleted_at: true },
    });

    if (!user || user.status === 'SUSPENDED' || user.deleted_at) {
      return errorResponse(res, 'Account is inactive', 403);
    }

    req.user = { ...payload, id: user.id, role: user.role, status: user.status };
    next();
  } catch {
    return errorResponse(res, 'Invalid or expired token', 401);
  }
};

export const optionalAuthenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, status: true, deleted_at: true },
      });
      if (user && user.status !== 'SUSPENDED' && !user.deleted_at) {
        req.user = { ...payload, id: user.id, role: user.role, status: user.status };
      }
    } catch {
      // invalid token — treat as unauthenticated
    }
  }
  next();
};
