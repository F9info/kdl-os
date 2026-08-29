import { successResponse, errorResponse } from '../../shared/utils/response.js';
import * as service from './service.js';

// Project scope (req.projectId) is injected by the shared requireProject
// middleware — it has already verified the caller has access to that
// project (see backend/src/middleware/project.js).

export const getAll = async (req, res, next) => {
  try {
    const { category } = req.validated.query;
    // req.projectId is only set when a projectId was given (see
    // requireProjectIfPresent in routes.js) — undefined lists across every
    // project, for callers with no project context.
    const items = await service.listCustomBlocks(req.projectId, category);
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const block = await service.createCustomBlock(req.validated.body, req.user?.id);
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const block = await service.updateCustomBlock(
      req.validated.params.id,
      req.projectId,
      req.validated.body,
      req.user?.id
    );
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postDuplicate = async (req, res, next) => {
  try {
    const block = await service.duplicateCustomBlock(
      req.validated.params.id,
      req.projectId,
      req.user?.id
    );
    successResponse(res, { block }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const postSetDefault = async (req, res, next) => {
  try {
    const block = await service.setDefaultCustomBlock(
      req.validated.params.id,
      req.projectId,
      req.user?.id
    );
    successResponse(res, { block });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deleteCustomBlock(req.validated.params.id, req.projectId, req.user?.id);
    successResponse(res, { ok: true });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};
