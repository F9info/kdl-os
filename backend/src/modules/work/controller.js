import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listWork = async (req, res, next) => {
  try {
    const items = await service.listWork(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getWork = async (req, res, next) => {
  try {
    const item = await service.getWorkById(req.validated.params.id);
    if (!item) return errorResponse(res, 'Work category not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const getPublicWork = async (req, res, next) => {
  try {
    const { slug } = req.validated.params;
    const { project_id } = req.validated.query;
    const result = await service.getPublicWorkBySlug(slug, project_id);
    if (!result) return errorResponse(res, 'Work category not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const createWork = async (req, res, next) => {
  try {
    const item = await service.createWork(req.validated.body, req.user?.id);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateWork = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await service.updateWork(id, req.validated.body);
    if (!item) return errorResponse(res, 'Work category not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteWork = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await service.deleteWork(id, req.user?.id);
    if (!deleted) return errorResponse(res, 'Work category not found', 404);
    return successResponse(res, { message: 'Work category deleted' });
  } catch (err) {
    next(err);
  }
};
