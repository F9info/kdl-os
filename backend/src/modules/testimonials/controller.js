import * as svc from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const list = async (req, res, next) => {
  try {
    return successResponse(res, { items: await svc.listItems(req.validated.query || {}) });
  } catch (err) {
    next(err);
  }
};

export const get = async (req, res, next) => {
  try {
    const item = await svc.getItem(req.validated.params.id);
    if (!item) return errorResponse(res, 'Testimonial item not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    return successResponse(res, { item: await svc.createItem(req.validated.body) }, 201);
  } catch (err) {
    next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const item = await svc.updateItem(req.validated.params.id, req.validated.body);
    if (!item) return errorResponse(res, 'Testimonial item not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const ok = await svc.deleteItem(req.validated.params.id);
    if (!ok) return errorResponse(res, 'Testimonial item not found', 404);
    return successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};
