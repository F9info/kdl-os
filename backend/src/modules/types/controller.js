import * as typeService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

export const listTypes = async (req, res, next) => {
  try {
    const result = await typeService.listTypes(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getType = async (req, res, next) => {
  try {
    const type = await typeService.getTypeById(req.validated.params.id);
    if (!type) return errorResponse(res, 'Type not found', 404);
    return successResponse(res, { type });
  } catch (err) {
    next(err);
  }
};

export const createType = async (req, res, next) => {
  try {
    const type = await typeService.createType(req.validated.body);
    return successResponse(res, { type }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateType = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const type = await typeService.updateType(id, req.validated.body);
    if (!type) return errorResponse(res, 'Type not found', 404);
    return successResponse(res, { type });
  } catch (err) {
    next(err);
  }
};

export const deleteType = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    // Resolve only standalone types; module-owned ids are treated as not-found.
    const exists = await typeService.getWritableTypeById(id);
    if (!exists) return errorResponse(res, 'Type not found', 404);

    // Block deletion while dependents exist — never auto-remove fields/categories.
    const { fields, categories } = await typeService.getTypeDependents(id);
    if (fields > 0 || categories > 0) {
      const parts = [];
      if (fields > 0) parts.push(`${fields} field${fields === 1 ? '' : 's'}`);
      if (categories > 0) parts.push(`${categories} ${categories === 1 ? 'category' : 'categories'}`);
      return errorResponse(
        res,
        `Cannot delete this type — it still has ${parts.join(' and ')}. Remove or reassign them first.`,
        409
      );
    }

    await typeService.deleteType(id);
    return successResponse(res, { message: 'Type deleted' });
  } catch (err) {
    next(err);
  }
};
