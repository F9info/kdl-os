// Shared middleware: validates X-Project-Id header against the projects table
// and verifies the caller has access to the named project.
//
// Usage: add to any route that reads project scope from X-Project-Id (after
//        authenticate and requirePermission, before the handler):
//
//   router.get('/runs/:runId', authenticate, requirePermission('template-engine', 'view'),
//              requireProject, validate(schema), handler);
//
// On success:  sets req.projectId and calls next().
// On missing header: 400.
// On unknown project (or soft-deleted): 404.
// On no access (project exists but caller is not the owner and not a super-admin): 403.
//
// Never defaults to any project — a call site that omits X-Project-Id must be
// fixed, not silently accepted.  Brand-kit, collateral, and credits routes will
// use this same middleware when their X-Project-Id scoping lands.

import { getProjectForAccessCheck } from '../modules/projects/service.js';
import { resolvePermissions } from '../modules/user-management/shared/permission-resolver.js';
import { errorResponse } from '../shared/utils/response.js';

export async function requireProject(req, res, next) {
  const projectId = req.headers['x-project-id'];
  if (!projectId) {
    return errorResponse(res, 'X-Project-Id header is required', 400);
  }

  let project;
  try {
    project = await getProjectForAccessCheck(projectId);
  } catch (err) {
    if (err.status === 404) {
      return errorResponse(res, 'Project not found', 404);
    }
    return next(err);
  }

  const userId = req.user?.id;
  // Reuse already-resolved permissions when the route ran requirePermission before us.
  const perms = req.userPermissions ?? (await resolvePermissions(userId));

  if (!perms.bypass && project.created_by !== userId) {
    return errorResponse(res, 'Forbidden — no access to this project', 403);
  }

  req.projectId = projectId;
  return next();
}
