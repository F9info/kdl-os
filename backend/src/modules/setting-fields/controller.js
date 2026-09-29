import * as fieldService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { INPUT_TYPES } from '../../shared/constants/inputTypes.js';

// Validate that referenced type/category exist before writing.
const checkRefs = async ({ type_id, category_id }) => {
  if (type_id && !(await fieldService.typeExists(type_id))) return 'Type not found';
  if (category_id && !(await fieldService.categoryExists(category_id))) return 'Category not found';
  return null;
};

export const listInputTypes = (req, res) =>
  successResponse(res, { input_types: INPUT_TYPES });

export const listFields = async (req, res, next) => {
  try {
    const result = await fieldService.listFields(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getField = async (req, res, next) => {
  try {
    const field = await fieldService.getFieldById(req.validated.params.id);
    if (!field) return errorResponse(res, 'Setting field not found', 404);
    return successResponse(res, { field });
  } catch (err) {
    next(err);
  }
};

export const createField = async (req, res, next) => {
  try {
    const refError = await checkRefs(req.validated.body);
    if (refError) return errorResponse(res, refError, 422);
    const field = await fieldService.createField(req.validated.body);
    return successResponse(res, { field }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateField = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    // Resolve only standalone fields; module-owned ids are treated as not-found.
    const exists = await fieldService.getWritableFieldById(id);
    if (!exists) return errorResponse(res, 'Setting field not found', 404);
    const refError = await checkRefs(req.validated.body);
    if (refError) return errorResponse(res, refError, 422);
    const field = await fieldService.updateField(id, req.validated.body);
    if (!field) return errorResponse(res, 'Setting field not found', 404);
    return successResponse(res, { field });
  } catch (err) {
    next(err);
  }
};

export const deleteField = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const deleted = await fieldService.deleteField(id);
    if (!deleted) return errorResponse(res, 'Setting field not found', 404);
    return successResponse(res, { message: 'Setting field deleted' });
  } catch (err) {
    next(err);
  }
};

export const reorderFields = async (req, res, next) => {
  try {
    await fieldService.reorderFields(req.validated.body.ids);
    return successResponse(res, { message: 'Order updated' });
  } catch (err) {
    next(err);
  }
};

// GET /by-type/:slug — the dynamic renderer feed: the Type plus its ordered fields.
export const getFieldsByTypeSlug = async (req, res, next) => {
  try {
    const type = await fieldService.getTypeBySlug(req.validated.params.slug);
    if (!type) return errorResponse(res, 'Type not found', 404);
    const fields = await fieldService.getFieldsForType(type.id);
    return successResponse(res, { type, fields });
  } catch (err) {
    next(err);
  }
};

// POST /values — bulk-save the values submitted from the dynamic form.
export const saveValues = async (req, res, next) => {
  try {
    const { type_id, values } = req.validated.body;
    if (!(await fieldService.typeExists(type_id))) {
      return errorResponse(res, 'Type not found', 422);
    }
    const updated = await fieldService.saveValues(type_id, values);
    return successResponse(res, { message: 'Settings saved', updated });
  } catch (err) {
    next(err);
  }
};

// GET /value/:slug — read a single value by slug (app-wide helper).
export const getValueBySlug = async (req, res, next) => {
  try {
    const field = await fieldService.getValueBySlug(req.validated.params.slug);
    if (!field) return errorResponse(res, 'Setting field not found', 404);
    return successResponse(res, { field });
  } catch (err) {
    next(err);
  }
};

// Public — no auth. Read-only, plain-value only (no file/media resolution).
export const getPublicValues = async (req, res, next) => {
  try {
    const slugs = req.validated.query.slugs.split(',').map((s) => s.trim()).filter(Boolean);
    const values = await fieldService.getValuesBySlugs(slugs);
    return successResponse(res, { values });
  } catch (err) {
    next(err);
  }
};

export const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) return errorResponse(res, 'No file uploaded', 400);
    const result = await fieldService.uploadSettingFile(req.file);
    return successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
};

export const removeGalleryItem = async (req, res, next) => {
  try {
    const { id, index } = req.validated.params;
    const field = await fieldService.removeGalleryItem(id, Number(index));
    if (!field) return errorResponse(res, 'Gallery field not found', 404);
    return successResponse(res, { field });
  } catch (err) {
    next(err);
  }
};
