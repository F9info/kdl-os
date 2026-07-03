import * as activityService from './service.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';

export const listActivity = async (req, res, next) => {
  try {
    const result = await activityService.listActivity(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    if (err instanceof RangeError || err.message?.includes('Invalid time value')) {
      return errorResponse(res, 'Invalid date filter', 422);
    }
    next(err);
  }
};
