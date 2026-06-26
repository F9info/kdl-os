import { errorResponse } from '../shared/utils/response.js';

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Unauthorized', 401);
    }
    if (!roles.includes(req.user.role)) {
      return errorResponse(res, 'Forbidden', 403);
    }
    next();
  };
};
