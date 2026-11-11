import { successResponse, errorResponse } from '../../shared/utils/response.js';

// Every handler: run the service, wrap the result, and hand failures to the error middleware.
export const h = (fn, status = 200) => async (req, res, next) => {
  try {
    return successResponse(res, await fn(req), status);
  } catch (err) {
    if (err.errors) return errorResponse(res, err.message, err.status ?? 422, err.errors);
    next(err);
  }
};
export const actor = (req) => req.user?.id ?? null;
export const v = (req) => req.validated;
