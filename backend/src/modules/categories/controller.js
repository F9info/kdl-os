import * as categoryService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';

const validateTypeId = async (type_id) => {
  if (!type_id) return true;
  const found = await categoryService.typeExists(type_id);
  return Boolean(found);
};

export const listCategories = async (req, res, next) => {
  try {
    const result = await categoryService.listCategories(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getCategory = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryById(req.validated.params.id);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, { category });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { type_id } = req.validated.body;
    if (!(await validateTypeId(type_id))) {
      return errorResponse(res, 'Type not found', 422);
    }
    const category = await categoryService.createCategory(req.validated.body);
    return successResponse(res, { category }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    // Resolve only standalone categories; module-owned ids are treated as not-found.
    const exists = await categoryService.getWritableCategoryById(id);
    if (!exists) return errorResponse(res, 'Category not found', 404);
    if (!(await validateTypeId(req.validated.body.type_id))) {
      return errorResponse(res, 'Type not found', 422);
    }
    const category = await categoryService.updateCategory(id, req.validated.body);
    if (!category) return errorResponse(res, 'Category not found', 404);
    return successResponse(res, { category });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    // Resolve only standalone categories; module-owned ids are treated as not-found.
    const exists = await categoryService.getWritableCategoryById(id);
    if (!exists) return errorResponse(res, 'Category not found', 404);
    await categoryService.deleteCategory(id);
    return successResponse(res, { message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};
