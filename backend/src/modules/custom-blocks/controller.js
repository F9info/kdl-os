import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createCustomBlockSchema, updateCustomBlockSchema } from './schema.js';
import * as service from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const { projectId, category } = req.query;
    if (!projectId || !category) {
      return errorResponse(res, 'projectId and category query params are required', 400);
    }
    const items = await service.listCustomBlocks(String(projectId), String(category));
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createCustomBlockSchema.parse(req.body);
    const block = await service.createCustomBlock(data, req.user?.id);
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = updateCustomBlockSchema.parse(req.body);
    const block = await service.updateCustomBlock(req.params.id, patch, req.user?.id);
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postDuplicate = async (req, res, next) => {
  try {
    const block = await service.duplicateCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postSetDefault = async (req, res, next) => {
  try {
    const block = await service.setDefaultCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deleteCustomBlock(req.params.id, req.user?.id);
    successResponse(res, { ok: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
