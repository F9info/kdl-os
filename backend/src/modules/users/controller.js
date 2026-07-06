import * as userService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { invalidatePermissionCache } from '../user-management/shared/permission-resolver.js';

function userIsSuperAdmin(user) {
  if (!user) return false;
  if (Array.isArray(user.roles) && user.roles.some((r) => r.slug === 'super-admin')) return true;
  return false;
}

function actorIsSuperAdmin(req) {
  if (Array.isArray(req.user?.roles) && req.user.roles.includes('super-admin')) return true;
  return false;
}

function log(req, action, subject, properties) {
  writeActivityAsync({
    actor: req.user?.id,
    module: 'users',
    action,
    subject_type: 'User',
    subject_id: subject?.id ?? null,
    description: action,
    properties,
    ip_address: getClientIp(req),
  });
}

function safeScrubBody(body) {
  const cleaned = {};
  for (const [key, value] of Object.entries(body)) {
    if (key === 'password') cleaned[key] = '[REDACTED]';
    else cleaned[key] = value;
  }
  return cleaned;
}

export const listUsers = async (req, res, next) => {
  try {
    const result = await userService.listUsers(req.validated.query || {});
    return successResponse(res, result);
  } catch (err) {
    next(err);
  }
};

export const getUser = async (req, res, next) => {
  try {
    const user = await userService.getUserById(req.validated.params.id);
    if (!user) return errorResponse(res, 'User not found', 404);
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

export const createUser = async (req, res, next) => {
  try {
    const { role_ids } = req.validated.body;

    if (!actorIsSuperAdmin(req) && role_ids?.length) {
      const hasSuperAdmin = await userService.roleIdsIncludeSuperAdmin(role_ids);
      if (hasSuperAdmin) {
        return errorResponse(res, 'Only Super Admin can assign the Super Admin role', 403);
      }
    }

    const user = await userService.createUser(req.validated.body);
    log(req, 'created', user, safeScrubBody(req.validated.body));
    return successResponse(res, { user }, 201);
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Email already in use', 409);
    }
    next(err);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);

    if (!actorIsSuperAdmin(req)) {
      if (userIsSuperAdmin(exists)) {
        return errorResponse(res, 'ADMIN cannot modify Super Admin users', 403);
      }
      if (req.validated.body.role_ids?.length) {
        const hasSuperAdmin = await userService.roleIdsIncludeSuperAdmin(req.validated.body.role_ids);
        if (hasSuperAdmin) {
          return errorResponse(res, 'ADMIN cannot assign the Super Admin role', 403);
        }
      }
    }

    const user = await userService.updateUser(id, req.validated.body);
    if (req.validated.body.role_ids !== undefined || req.validated.body.status !== undefined) {
      await invalidatePermissionCache();
    }
    log(req, 'updated', user, safeScrubBody(req.validated.body));
    return successResponse(res, { user });
  } catch (err) {
    if (err.code === 'P2002') {
      return errorResponse(res, 'Email already in use', 409);
    }
    next(err);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    if (id === req.user?.id) {
      return errorResponse(res, 'You can not delete your own account', 409);
    }

    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);

    if (!actorIsSuperAdmin(req) && userIsSuperAdmin(exists)) {
      return errorResponse(res, 'Cannot delete Super Admin user', 403);
    }

    const user = await userService.softDeleteUser(id);
    await invalidatePermissionCache();
    log(req, 'deleted', user, { id });
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { password } = req.validated.body;

    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);

    if (!actorIsSuperAdmin(req) && userIsSuperAdmin(exists)) {
      return errorResponse(res, 'Only Super Admin can reset a Super Admin password', 403);
    }

    const user = await userService.resetPassword(id, password);
    await invalidatePermissionCache();
    log(req, 'reset_password', user, { id });
    return successResponse(res, { user });
  } catch (err) {
    next(err);
  }
};

export const getOverrides = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);
    const overrides = await userService.getUserOverrides(id);
    return successResponse(res, { overrides });
  } catch (err) {
    next(err);
  }
};

export const updateOverrides = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const { overrides } = req.validated.body;

    const exists = await userService.getUserById(id);
    if (!exists) return errorResponse(res, 'User not found', 404);

    const user = await userService.updateUserOverrides(id, overrides);
    await invalidatePermissionCache();
    log(req, 'overrides_updated', user, { overrides });
    return successResponse(res, { user });
  } catch (err) {
    if (err.code === 'P2002' || err.code === 'P2003') {
      return errorResponse(res, 'One or more permissions are invalid', 422);
    }
    next(err);
  }
};
