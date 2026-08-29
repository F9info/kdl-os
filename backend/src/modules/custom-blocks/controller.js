import { successResponse, errorResponse } from '../../shared/utils/response.js';
import * as service from './service.js';

// Project scope (req.projectId) is injected by the shared requireProject
// middleware — it has already verified the caller has access to that
// project (see backend/src/middleware/project.js).

export const getAll = async (req, res, next) => {
  try {
    const { category } = req.validated.query;
    // req.projectId is set when a projectId was given (scoped to exactly
    // that project). Otherwise scopeProjectForList (routes.js) set
    // req.accessibleProjectIds: an array of every project this caller can
    // access, or null for a super-admin (no restriction).
    const items = req.projectId
      ? await service.listCustomBlocks(req.projectId, category)
      : await service.listCustomBlocksForAccessibleProjects(req.accessibleProjectIds, category);
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
