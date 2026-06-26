import jwt from 'jsonwebtoken';
import { errorResponse } from '../utils/response.js';

export function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    const token = (header?.startsWith('Bearer ') ? header.slice(7) : null)
      ?? req.cookies?.['kdl-auth-token']
      ?? null;

    if (!token) return errorResponse(res, 'Unauthorized', 401);

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return errorResponse(res, 'Unauthorized', 401);
  }
}
