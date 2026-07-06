import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createExampleSchema } from './schema.js';
import { listExamples, createExample } from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await listExamples();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createExampleSchema.parse(req.body);
    const item = await createExample(data, req.user?.id);
    successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
