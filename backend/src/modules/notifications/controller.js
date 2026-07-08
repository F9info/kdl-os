import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createNotificationsSchema } from './schema.js';
import { listNotificationss, createNotifications } from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await listNotificationss();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createNotificationsSchema.parse(req.body);
    const item = await createNotifications(data, req.user?.id);
    successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
