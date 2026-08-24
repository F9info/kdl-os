import { errorResponse } from '../shared/utils/response.js';
import { prisma } from '../config/database.js';
import { resolvePermissions } from '../modules/user-management/shared/permission-resolver.js';

/**
 * requireProject — validate X-Project-Id header against the projects module.
 *
 * Responses:
 *   400 — header missing
 *   404 — project does not exist (or has been soft-deleted)
 *   403 — project exists but the authenticated caller does not own/belong to it
 *
 * On success:
 *   req.project  = { id, name, slug, created_by }
 *   req.projectId = project.id  (convenience alias)
 *
 * Super-admin users (bypass === true from resolvePermissions) skip the ownership
 * check and can access any project.
 */
export const requireProject = async (req, res, next) => {
  try {
    const projectId = req.headers['x-project-id'];
    if (!projectId) {
      return errorResponse(res, 'X-Project-Id header is required', 400);
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, deleted_at: null },
      select: { id: true, name: true, slug: true, created_by: true },
    });

    if (!project) {
      return errorResponse(res, 'Project not found', 404);
    }

    // Super-admin bypasses ownership check — any authenticated user with bypass
    // can access any project.  For everyone else, the project must belong to them.
    const perms = req.userPermissions ?? (await resolvePermissions(req.user?.id));
    if (!perms.bypass && project.created_by !== req.user?.id) {
      return errorResponse(res, 'Forbidden', 403);
    }

    req.project = project;
    req.projectId = project.id;
    return next();
  } catch (err) {
    return next(err);
  }
};
