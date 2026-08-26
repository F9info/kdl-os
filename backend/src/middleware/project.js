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
// On no access (not owner, not member, not super-admin, not shared): 403.
//
// Access is granted when ANY of the following hold:
//   1. project.is_shared = true  (org-shared; e.g. the seeded Default Project)
//   2. perms.bypass = true       (super-admin)
//   3. project.created_by === userId  (project owner)
//   4. project.members contains a row for userId  (explicit member)
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

    // is_shared = explicit org-shared flag; allow all authenticated users (e.g. Default Project).
    if (project.is_shared) {
      req.projectId = projectId;
      return next();
    }

    const userId = req.user?.id;
    // Reuse already-resolved permissions when the route ran requirePermission before us.
    const perms = req.userPermissions ?? (await resolvePermissions(userId));

    // super-admin bypass
    if (perms.bypass) {
      req.projectId = projectId;
      return next();
    }

    const isOwner = project.created_by === userId;
    const isMember = project.members.some((m) => m.user_id === userId);

    if (!isOwner && !isMember) {
      return errorResponse(res, 'Forbidden — no access to this project', 403);
    }

    req.projectId = projectId;
    return next();
  };
}
