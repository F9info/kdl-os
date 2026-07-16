import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createPageSchema, updatePageSchema } from './schema.js';
import * as service from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await service.listPages();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const page = await service.getPage(req.params.id);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page });
  } catch (err) {
    next(err);
  }
};

// Public — no auth. Only returns PUBLISHED pages.
export const getPublic = async (req, res, next) => {
  try {
    const page = await service.getPublishedBySlug(req.params.slug);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createPageSchema.parse(req.body);
    const page = await service.createPage(data, req.user?.id);
    successResponse(res, { page }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = updatePageSchema.parse(req.body);
    const page = await service.updatePage(req.params.id, patch, req.user?.id);
    successResponse(res, { page });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deletePage(req.params.id, req.user?.id);
    successResponse(res, { ok: true });
  } catch (err) {
    next(err);
  }
};
