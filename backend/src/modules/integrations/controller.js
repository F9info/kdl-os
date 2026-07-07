import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createIntegrationsSchema } from './schema.js';
import { listIntegrationss, createIntegrations } from './service.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await listIntegrationss();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createIntegrationsSchema.parse(req.body);
    const item = await createIntegrations(data, req.user?.id);
    successResponse(res, { item }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
