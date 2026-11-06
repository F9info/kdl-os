import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { getOnboarding, answerOnboarding } from './onboarding.js';
import { getSiteLayout, saveSiteLayout } from './layout.js';
import { getSiteIdentityWithPreviews, saveSiteIdentity } from './site-identity.js';
import { listSites, listProjects, getProject, createProject, updateProject, deleteProject } from './service.js';

export const handleList = async (req, res, next) => {
  try {
    const data = await listProjects();
    successResponse(res, data);
  } catch (err) {
    next(err);
  }
};

export const handleGet = async (req, res, next) => {
  try {
    const data = await getProject(req.params.id);
    successResponse(res, data);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleCreate = async (req, res, next) => {
  try {
    const { name, slug, is_default } = req.validated?.body ?? req.body;
    const data = await createProject({ name, slug, is_default, actorId: req.user?.id ?? null });
    successResponse(res, data, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleUpdate = async (req, res, next) => {
  try {
    const { name, slug, is_default } = req.validated?.body ?? req.body;
    const data = await updateProject(req.params.id, { name, slug, is_default });
    successResponse(res, data);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleDelete = async (req, res, next) => {
  try {
    await deleteProject(req.params.id);
    successResponse(res, { deleted: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleGetOnboarding = async (req, res, next) => {
  try {
    successResponse(res, await getOnboarding());
  } catch (err) {
    next(err);
  }
};

export const handleAnswerOnboarding = async (req, res, next) => {
  try {
    const { frontend } = req.validated?.body ?? req.body;
    successResponse(res, await answerOnboarding(frontend, req.user?.id ?? null));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleGetLayout = async (req, res, next) => {
  try {
    successResponse(res, { layout: await getSiteLayout(req.params.id) });
  } catch (err) {
    next(err);
  }
};

export const handleSaveLayout = async (req, res, next) => {
  try {
    successResponse(res, { layout: await saveSiteLayout(req.params.id, req.validated.body) });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleListSites = async (req, res, next) => {
  try {
    successResponse(res, { sites: await listSites(req.params.id) });
  } catch (err) {
    next(err);
  }
};

export const handleGetSiteIdentity = async (req, res, next) => {
  try {
    const { id, siteId } = req.validated.params;
    successResponse(res, await getSiteIdentityWithPreviews(id, siteId));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleSaveSiteIdentity = async (req, res, next) => {
  try {
    const { id, siteId } = req.validated.params;
    successResponse(res, { identity: await saveSiteIdentity(id, siteId, req.validated.body) });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
