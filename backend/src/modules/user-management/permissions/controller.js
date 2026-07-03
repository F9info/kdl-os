import * as permissionService from './service.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { writeActivity, getClientIp } from '../shared/activity-logger.js';
import { invalidatePermissionCache } from '../shared/permission-resolver.js';

export const getMatrix = async (req, res, next) => {
  try {
    const matrix = await permissionService.getPermissionMatrix();
    return successResponse(res, { matrix });
  } catch (err) {
    next(err);
  }
};

export const createModule = async (req, res, next) => {
  try {
    const result = await permissionService.createModule(req.validated.body);
    await invalidatePermissionCache();
    writeActivity({
      actor: req.user.id,
      module: 'permissions',
      action: 'created',
      subject_type: 'PermissionModule',
      subject_id: result.module.id,
      description: `Permission module "${result.module.label}" created`,
      properties: {
        name: result.module.name,
        label: result.module.label,
        permissions: result.permissions.map((p) => p.id),
      },
      ip_address: getClientIp(req),
    });
    return successResponse(res, result, 201);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Module with that name already exists', 409);
    }
    next(err);
  }
};

export const updateModule = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const existing = await permissionService.getModuleById(id);
    if (!existing) return errorResponse(res, 'Module not found', 404);

    if (existing.is_system && req.validated.body.name !== undefined) {
      return errorResponse(res, 'Cannot rename a system module', 409);
    }

    const result = await permissionService.updateModule(id, req.validated.body);
    if (req.validated.body.name !== undefined) {
      await invalidatePermissionCache();
    }
    writeActivity({
      actor: req.user.id,
      module: 'permissions',
      action: 'updated',
      subject_type: 'PermissionModule',
      subject_id: result.id,
      description: `Permission module "${result.label}" updated`,
      properties: { changed: Object.keys(req.validated.body) },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { module: result });
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Module with that name already exists', 409);
    }
    next(err);
  }
};

export const deleteModule = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const existing = await permissionService.getModuleById(id);
    if (!existing) return errorResponse(res, 'Module not found', 404);
    if (existing.is_system) {
      return errorResponse(res, 'Cannot delete a system module', 409);
    }

    const references = await permissionService.countPermissionReferences(id);
    if (references.roles > 0 || references.users > 0) {
      return errorResponse(
        res,
        'Unable to delete: permissions in this module are assigned to roles or users',
        409,
      );
    }

    await permissionService.deleteModule(id);
    await invalidatePermissionCache();
    writeActivity({
      actor: req.user.id,
      module: 'permissions',
      action: 'deleted',
      subject_type: 'PermissionModule',
      subject_id: id,
      description: `Permission module "${existing.label}" deleted`,
      properties: { name: existing.name, label: existing.label },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { message: 'Module deleted' });
  } catch (err) {
    next(err);
  }
};
