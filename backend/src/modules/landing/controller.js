import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { listTemplates, buildLandingData, LANDING_TEMPLATES } from './templates.js';
import { listLandingSites, createLandingPage, deleteLandingSite } from './service.js';

export const handleTemplates = (_req, res) => successResponse(res, { templates: listTemplates() });

// The page a template would create, for the "View template" screen. Nothing is stored.
export const handlePreview = (req, res) => {
  const { key } = req.params;
  if (!Object.hasOwn(LANDING_TEMPLATES, key)) return errorResponse(res, 'Unknown template', 404);
  const { name } = LANDING_TEMPLATES[key];
  successResponse(res, { name, data: buildLandingData(key, 'preview', name) });
};

export const handleList = async (req, res, next) => {
  try {
    successResponse(res, { sites: await listLandingSites(undefined, req.projectId) });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleCreate = async (req, res, next) => {
  try {
    successResponse(res, { site: await createLandingPage(req.validated.body, req.user?.id ?? null, undefined, req.projectId) }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleDelete = async (req, res, next) => {
  try {
    await deleteLandingSite(req.params.siteId, req.user?.id ?? null, undefined, req.projectId);
    successResponse(res, { deleted: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
