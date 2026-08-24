// Shared middleware factory: validates the project id against the projects table
// and verifies the caller has access to that project.
//
// Usage — pass the source where the route exposes the project id:
//   requireProject()          reads X-Project-Id header (default)
//   requireProject('body')    reads req.validated.body.projectId  (run validate() first)
//   requireProject('query')   reads req.validated.query.projectId (run validate() first)
//
// On success:  sets req.projectId and calls next().
// On missing value:                400.
// On unknown project (or soft-deleted): 404.
// On no access (non-null owner != caller and not super-admin): 403.
// Projects with null created_by are org-shared (e.g. the seeded Default Project)
// and are accessible to all authenticated users.
//
// Brand-kit, collateral, and credits routes will use this same middleware when
// their project scoping lands.

import { getProjectForAccessCheck } from '../modules/projects/service.js';
import { resolvePermissions } from '../modules/user-management/shared/permission-resolver.js';
import { errorResponse } from '../shared/utils/response.js';

export function requireProject(source = 'header') {
  return async function requireProjectMiddleware(req, res, next) {
    let projectId;
    if (source === 'header') {
      projectId = req.headers['x-project-id'];
    } else if (source === 'body') {
      projectId = req.validated?.body?.projectId;
    } else {
      projectId = req.validated?.query?.projectId;
    }

    if (!projectId) {
      const msg =
        source === 'header' ? 'X-Project-Id header is required' : 'projectId is required';
      return errorResponse(res, msg, 400);
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

    // null created_by = org-shared project (e.g. the seeded Default Project); allow all.
    // Only deny when the project has an explicit owner and it is not the caller.
    if (!perms.bypass && project.created_by !== null && project.created_by !== userId) {
      return errorResponse(res, 'Forbidden — no access to this project', 403);
    }

    req.projectId = projectId;
    return next();
  };
}
