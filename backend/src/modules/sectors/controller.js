import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listSectors = async (req, res, next) => {
  try {
    const items = await service.listSectors(req.validated.query || {});
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getSector = async (req, res, next) => {
  try {
    const item = await service.getSectorById(req.validated.params.id);
    if (!item) return errorResponse(res, 'Sector not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const getPublicSector = async (req, res, next) => {
  try {
    const { slug } = req.validated.params;
    const { project_id } = req.validated.query;
    const result = await service.getPublicSectorBySlug(slug, project_id);
    if (!result) return errorResponse(res, 'Sector not found', 404);
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const createSector = async (req, res, next) => {
  try {
    const item = await service.createSector(req.validated.body, req.user?.id);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateSector = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const item = await service.updateSector(id, req.validated.body);
    if (!item) return errorResponse(res, 'Sector not found', 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteSector = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await service.deleteSector(id, req.user?.id);
    if (!deleted) return errorResponse(res, 'Sector not found', 404);
    return successResponse(res, { message: 'Sector deleted' });
  } catch (err) {
    next(err);
  }
};
