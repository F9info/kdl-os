import { errorResponse } from '../shared/utils/response.js';
import { logger } from '../shared/utils/logger.js';

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error(err.message, { stack: err.stack, path: req.path, method: req.method });

  if (err.name === 'ValidationError') {
    return errorResponse(res, err.message, 422);
  }

  if (err.name === 'UnauthorizedError') {
    return errorResponse(res, 'Unauthorized', 401);
  }

  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' && statusCode === 500
    ? 'Internal server error'
    : err.message || 'Internal server error';

  return errorResponse(res, message, statusCode);
};
