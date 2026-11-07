import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { getClientIp } from '../user-management/shared/activity-logger.js';
import * as service from './service.js';

// Service errors carry an HTTP status (404/409/422); anything else goes to the error middleware.
const handle = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status, err.errors);
    next(err);
  }
};

export const handleList = handle(async (req, res) =>
  successResponse(res, { items: await service.listForms(req.projectId) })
);

export const handleCreate = handle(async (req, res) =>
  successResponse(res, { item: await service.createForm(req.validated.body, req.user?.id ?? null, undefined, req.projectId) }, 201)
);

export const handleUpdate = handle(async (req, res) =>
  successResponse(res, {
    item: await service.updateForm(req.validated.params.id, req.validated.body, req.user?.id ?? null, req.projectId),
  })
);

export const handleDelete = handle(async (req, res) => {
  await service.deleteForm(req.validated.params.id, req.user?.id ?? null, req.projectId);
  successResponse(res, null);
});

export const handleSubmissions = handle(async (req, res) =>
  successResponse(res, {
    items: await service.listSubmissions(req.validated.params.id, req.validated.query.limit, req.projectId),
  })
);

export const handlePublicGet = handle(async (req, res) =>
  successResponse(res, { form: await service.getPublicForm(req.validated.params.slug) })
);

export const handlePublicSubmit = handle(async (req, res) =>
  successResponse(res, await service.submitForm(req.validated.params.slug, req.body, getClientIp(req)), 201)
);
