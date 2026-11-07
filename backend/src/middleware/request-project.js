// Resolves "which project is this admin request for" and checks the caller may use it.
//
// The project comes from, in order: the X-Project-Id header (the admin app sends the project chosen in
// the top bar switcher), ?projectId= or ?project_id=, then the default project (so callers that send
// nothing keep working). The access check is requireProject's: shared project, super-admin, owner or
// member. Run it AFTER requirePermission so the resolved permissions are reused.
//
//   router.get('/', requirePermission('forms', 'view'), requestProject, handleList);
//
// On success req.projectId is set. Public (unauthenticated) routes must not use this: they resolve
// their project from the visitor's host or site instead.

import { requireProject } from './project.js';
import { getDefaultProjectId } from '../shared/default-project.js';

const str = (v) => (typeof v === 'string' && v !== '' ? v : undefined);

export const resolveRequestedProjectId = async (req) =>
  str(req.headers?.['x-project-id']) ??
  str(req.query?.projectId) ??
  str(req.query?.project_id) ??
  (await getDefaultProjectId()) ??
  undefined; // undefined = no project exists: requireProject answers 404

export const requestProject = requireProject(resolveRequestedProjectId);
