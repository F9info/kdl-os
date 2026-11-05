import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { listTemplates } from './templates.js';
import { listLandingSites, createLandingPage } from './service.js';

export const handleTemplates = (_req, res) => successResponse(res, { templates: listTemplates() });

export const handleList = async (_req, res, next) => {
  try {
    successResponse(res, { sites: await listLandingSites() });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleCreate = async (req, res, next) => {
  try {
    successResponse(res, { site: await createLandingPage(req.validated.body, req.user?.id ?? null) }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
