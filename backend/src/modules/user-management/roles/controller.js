import * as roleService from './service.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { writeActivity, getClientIp } from '../shared/activity-logger.js';
import { invalidatePermissionCache } from '../shared/permission-resolver.js';

export const listRoles = async (req, res, next) => {
  try {
    const result = await roleService.listRoles(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getRole = async (req, res, next) => {
  try {
    const role = await roleService.getRoleById(req.validated.params.id);
    if (!role) return errorResponse(res, 'Role not found', 404);
    return successResponse(res, { role });
  } catch (err) {
    next(err);
  }
};

export const createRole = async (req, res, next) => {
  try {
    const role = await roleService.createRole(req.validated.body);
    await invalidatePermissionCache();
    writeActivity({
      actor: req.user.id,
      module: 'roles',
      action: 'created',
      subject_type: 'RbacRole',
      subject_id: role.id,
      description: `Role "${role.name}" created`,
      properties: {
        name: role.name,
        slug: role.slug,
        permission_ids: req.validated.body.permission_ids,
      },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { role }, 201);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Role with that name or slug already exists', 409);
    }
    if (err.code === 'P2003' || err.message === 'Invalid permission reference') {
      return errorResponse(res, 'One or more permissions are invalid', 422);
    }
    next(err);
  }
};

export const updateRole = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const existing = await roleService.getRoleById(id);
    if (!existing) return errorResponse(res, 'Role not found', 404);

    // System roles cannot be renamed; description stays editable.
    if (existing.is_system && req.validated.body.name !== undefined) {
      return errorResponse(res, 'Cannot rename a system role', 409);
    }

    const role = await roleService.updateRole(id, req.validated.body);
    await invalidatePermissionCache();
    writeActivity({
      actor: req.user.id,
      module: 'roles',
      action: 'updated',
      subject_type: 'RbacRole',
      subject_id: role.id,
      description: `Role "${role.name}" updated`,
      properties: {
        changed: Object.keys(req.validated.body),
        permission_ids: req.validated.body.permission_ids,
      },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { role });
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Role with that name or slug already exists', 409);
    }
    if (err.code === 'P2003' || err.message?.includes('Invalid permission reference')) {
      return errorResponse(res, 'One or more permissions are invalid', 422);
    }
    next(err);
  }
};

export const deleteRole = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const existing = await roleService.getRoleById(id);
    if (!existing) return errorResponse(res, 'Role not found', 404);
    if (existing.is_system) {
      return errorResponse(res, 'Cannot delete a system role', 409);
    }

    const userCount = await roleService.countRoleUsers(id);
    if (userCount > 0) {
      return errorResponse(res, 'Unable to delete: users are assigned to this role', 409);
    }

    await roleService.deleteRole(id);
    await invalidatePermissionCache();
    writeActivity({
      actor: req.user.id,
      module: 'roles',
      action: 'deleted',
      subject_type: 'RbacRole',
      subject_id: id,
      description: `Role "${existing.name}" deleted`,
      properties: { name: existing.name, slug: existing.slug },
      ip_address: getClientIp(req),
    });
    return successResponse(res, { message: 'Role deleted' });
  } catch (err) {
    next(err);
  }
};
