import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listCatalog = async (req, res, next) => {
  try {
    const items = await service.listCatalog(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getCatalog = async (req, res, next) => {
  try {
    const item = await service.getCatalogById(req.validated.params.id);
    if (!item) return errorResponse(res, 'Catalog item not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const getPublicCatalog = async (req, res, next) => {
  try {
    const { slug } = req.validated.params;
    const { project_id } = req.validated.query;
    const result = await service.getPublicCatalogBySlug(slug, project_id);
    if (!result) return errorResponse(res, 'Catalog item not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const createCatalog = async (req, res, next) => {
  try {
    const item = await service.createCatalog(req.validated.body, req.user?.id);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCatalog = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await service.updateCatalog(id, req.validated.body);
    if (!item) return errorResponse(res, 'Catalog item not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteCatalog = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await service.deleteCatalog(id, req.user?.id);
    if (!deleted) return errorResponse(res, 'Catalog item not found', 404);
    return successResponse(res, { message: 'Catalog item deleted' });
  } catch (err) {
    next(err);
  }
};
