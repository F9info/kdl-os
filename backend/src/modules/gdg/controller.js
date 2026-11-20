import * as service from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

const NOT_FOUND = 'Event not found';

export const getPublicFeed = async (req, res, next) => {
  try {
    const projectId = req.validated.query.project_id ?? (await getDefaultProjectId());
    if (!projectId) return errorResponse(res, 'Project not found', 404);
    return successResponse(res, await service.getPublicFeed(projectId));
  } catch (err) {
    next(err);
  }
};

export const listEvents = async (req, res, next) => {
  try {
    const items = await service.listEvents({ ...req.validated.query, project_id: req.validated.query.project_id ?? req.projectId });
    return successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getEvent = async (req, res, next) => {
  try {
    const item = await service.getEventById(req.validated.params.id);
    if (!item) return errorResponse(res, NOT_FOUND, 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const createEvent = async (req, res, next) => {
  try {
    const body = { ...req.validated.body, project_id: req.validated.body.project_id ?? req.projectId };
    const item = await service.createEvent(body, req.user?.id);
    return successResponse(res, { item }, 201);
  } catch (err) {
    next(err);
  }
};

export const updateEvent = async (req, res, next) => {
  try {
    const { project_id: _ignored, ...body } = req.validated.body;
    const item = await service.updateEvent(req.validated.params.id, body, req.user?.id);
    if (!item) return errorResponse(res, NOT_FOUND, 404);
    return successResponse(res, { item });
  } catch (err) {
    next(err);
  }
};

export const deleteEvent = async (req, res, next) => {
  try {
    const deleted = await service.deleteEvent(req.validated.params.id, req.user?.id);
    if (!deleted) return errorResponse(res, NOT_FOUND, 404);
    return successResponse(res, { message: 'Event deleted' });
  } catch (err) {
    next(err);
  }
};

export const getSync = async (req, res, next) => {
  try {
    return successResponse(res, { settings: await service.getSyncSettings(req.projectId) });
  } catch (err) {
    next(err);
  }
};

export const saveSync = async (req, res, next) => {
  try {
    const { project_id: _ignored, ...data } = req.validated.body;
    return successResponse(res, { settings: await service.saveSyncSettings(req.projectId, data, req.user?.id) });
  } catch (err) {
    next(err);
  }
};

export const runSync = async (req, res, next) => {
  try {
    const result = await service.runSync(req.projectId, { actorId: req.user?.id });
    return successResponse(res, { result });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
