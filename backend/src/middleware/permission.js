import { errorResponse } from '../shared/utils/response.js';
import { requireRole as rbacRequireRole } from './rbac.js';
import { resolvePermissions, hasPermission } from '../modules/user-management/shared/permission-resolver.js';
import { writeActivityAsync, getClientIp } from '../modules/user-management/shared/activity-logger.js';

export { rbacRequireRole as requireRole };

/**
 * Express middleware factory that requires the current user to hold a
 * specific RBAC permission (`module:action`).
 *
 * Super Admin bypasses all checks.
 *
 * On success the resolved permission map is attached to `req.userPermissions`
 * so downstream handlers can make optional permission decisions without
 * re-querying.
 */
export const requirePermission = (moduleName, action, options = {}) => {
  const { logDenials = true } = options;

  return async (req, res, next) => {
    try {
      if (!req.user?.id) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      const result = await resolvePermissions(req.user.id);

      if (result.bypass || result.permissions.includes(`${moduleName}:${action}`)) {
        req.userPermissions = result;
        return next();
      }

      if (logDenials) {
        writeActivityAsync({
          actor: req.user.id,
          module: `authz:${moduleName}`,
          action: 'permission_denied',
          description: `Access denied to ${moduleName}:${action}`,
          properties: { requested_module: moduleName, requested_action: action },
          ip_address: getClientIp(req),
        });
      }

      return errorResponse(res, 'Forbidden', 403);
    } catch (err) {
      return next(err);
    }
  };
};
