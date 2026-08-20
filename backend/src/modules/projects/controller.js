import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { listProjects, getProject, createProject, updateProject, deleteProject } from './service.js';

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
