import { successResponse, errorResponse } from '../../shared/utils/response.js';
import {
  listLibraryTemplates,
  getLibraryTemplate,
  buildLandingData,
  duplicateTemplate,
  updateTemplate,
  deleteTemplate,
  templateFromPage,
} from './template-library.js';
import { listLandingSites, createLandingPage, deleteLandingSite } from './service.js';

const fail = (res, next, err) => (err.status ? errorResponse(res, err.message, err.status) : next(err));

export const handleTemplates = async (_req, res, next) => {
  try {
    successResponse(res, { templates: await listLibraryTemplates() });
  } catch (err) {
    fail(res, next, err);
  }
};

// The page a template would create, for the "View template" screen. Nothing is stored.
export const handlePreview = async (req, res, next) => {
  try {
    const tpl = await getLibraryTemplate(req.params.key);
    successResponse(res, { name: tpl.name, data: buildLandingData(tpl, 'preview', tpl.name) });
  } catch (err) {
    fail(res, next, err);
  }
};

export const handleDuplicateTemplate = async (req, res, next) => {
  try {
    const { name } = req.validated.body;
    successResponse(res, { template: await duplicateTemplate(req.params.key, { name }, req.user?.id ?? null) }, 201);
  } catch (err) {
    fail(res, next, err);
  }
};

export const handleUpdateTemplate = async (req, res, next) => {
  try {
    successResponse(res, { template: await updateTemplate(req.params.key, req.validated.body) });
  } catch (err) {
    fail(res, next, err);
  }
};

export const handleDeleteTemplate = async (req, res, next) => {
  try {
    await deleteTemplate(req.params.key);
    successResponse(res, { deleted: true });
  } catch (err) {
    fail(res, next, err);
  }
};

export const handleSaveAsTemplate = async (req, res, next) => {
  try {
    const { pageId, name, description } = req.validated.body;
    successResponse(res, { template: await templateFromPage(pageId, { name, description }, req.user?.id ?? null, req.projectId) }, 201);
  } catch (err) {
    fail(res, next, err);
  }
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
