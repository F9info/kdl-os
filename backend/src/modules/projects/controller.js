import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { getOnboarding, answerOnboarding } from './onboarding.js';
import { getSiteLayout, saveSiteLayout } from './layout.js';
import { getSiteIdentityWithPreviews, saveSiteIdentity } from './site-identity.js';
import { setWorkflowStep } from './workflow.js';
import { checkLaunch, launchProject } from './launch.js';
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
    const { name, slug, is_default, kinds, status, config } = req.validated?.body ?? req.body;
    const data = await createProject({ name, slug, is_default, kinds, status, config, actorId: req.user?.id ?? null });
    successResponse(res, data, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleUpdate = async (req, res, next) => {
  try {
    const { name, slug, is_default, kinds, status, config } = req.validated?.body ?? req.body;
    const data = await updateProject(req.params.id, { name, slug, is_default, kinds, status, config });
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

export const handleWorkflowStep = async (req, res, next) => {
  try {
    const { step, done } = req.validated?.body ?? req.body;
    successResponse(res, { workflow: await setWorkflowStep(req.params.id, step, done) });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleLaunchCheck = async (req, res, next) => {
  try {
    successResponse(res, await checkLaunch(req.params.id));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const handleLaunch = async (req, res, next) => {
  try {
    const { force = false } = req.validated?.body ?? req.body ?? {};
    successResponse(res, await launchProject(req.params.id, req.user?.id, { force }));
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.errors);
    next(err);
  }
};
