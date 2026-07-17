import * as userService from './service.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { invalidatePermissionCache, resolvePermissions } from '../user-management/shared/permission-resolver.js';

function userIsSuperAdmin(user) {
  if (!user) return false;
  if (Array.isArray(user.roles) && user.roles.some((r) => r.slug === 'super-admin')) return true;
  return false;
}

function actorIsSuperAdmin(req) {
  if (Array.isArray(req.user?.roles) && req.user.roles.includes('super-admin')) return true;
  return false;
}

// Privilege ceiling (KDL-273 H3): an actor may only assign roles whose combined
// permission set is a subset of the actor's own effective permissions. Based on
// resolvePermissions (DB/cache-backed), not the JWT roles claim, so a stale or
// forged-claim token cannot widen the ceiling.
async function roleAssignmentDenial(req, roleIds) {
  if (!roleIds?.length) return null;

  const actor = await resolvePermissions(req.user?.id);
  if (actor.bypass) return null;

  if (await userService.roleIdsIncludeSuperAdmin(roleIds)) {
    return 'Only Super Admin can assign the Super Admin role';
  }

  const roleKeys = await userService.getPermissionKeysForRoles(roleIds);
  const actorSet = new Set(actor.permissions);
  if (roleKeys.some((key) => !actorSet.has(key))) {
    return 'Cannot assign roles with permissions you do not hold';
  }

  return null;
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

    const denial = await roleAssignmentDenial(req, role_ids);
    if (denial) return errorResponse(res, denial, 403);

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

    if (!actorIsSuperAdmin(req) && userIsSuperAdmin(exists)) {
      return errorResponse(res, 'ADMIN cannot modify Super Admin users', 403);
    }

    if (req.validated.body.role_ids !== undefined) {
      // KDL-273 H3: no self-role modification — a users:edit holder must not be
      // able to widen (or accidentally destroy) their own role set. Super Admin
      // is exempt via the bypass check inside resolvePermissions.
      const actor = await resolvePermissions(req.user?.id);
      if (!actor.bypass && id === req.user?.id) {
        return errorResponse(res, 'You cannot modify your own roles', 403);
      }
      const denial = await roleAssignmentDenial(req, req.validated.body.role_ids);
      if (denial) return errorResponse(res, denial, 403);
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

    // KDL-273 H4: a permissions:edit holder must not be able to escalate via
    // overrides — no editing your own overrides, and GRANTs are capped at the
    // actor's own effective permission set (DENYs only ever narrow access).
    const actor = await resolvePermissions(req.user?.id);
    if (!actor.bypass) {
      if (id === req.user?.id) {
        return errorResponse(res, 'You cannot modify your own permission overrides', 403);
      }
      const grantIds = overrides.filter((o) => o.mode === 'GRANT').map((o) => o.permission_id);
      if (grantIds.length) {
        const keysById = await userService.getPermissionKeysByIds(grantIds);
        const actorSet = new Set(actor.permissions);
        if (grantIds.some((pid) => !actorSet.has(keysById.get(pid)))) {
          return errorResponse(res, 'Cannot grant permissions you do not hold', 403);
        }
      }
    }

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
