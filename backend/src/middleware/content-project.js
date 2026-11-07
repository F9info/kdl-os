// Project isolation for the admin routes of the content modules (team, faq, sectors, catalog, work, gallery,
// testimonials, projects-content, menus). Their rows carry a project_id, but before this nothing checked that
// the caller may use that project: a user in project A could list, edit, delete or move project B's rows by
// naming B (or by knowing a row id). Two guards close that, one line each in a module's routes.js:
//
//   router.use(authenticate);
//   router.use(contentProject());                        // the project a request names or defaults to
//   router.param('id', recordProject('teamMember'));     // the project a row addressed by :id belongs to
//
// Both end in requireProject, so "may use this project" means the same everywhere: shared project, super-admin,
// owner or member. Public routes are mounted before these guards and are not affected.

import { requireProject } from './project.js';
import { prisma } from '../config/database.js';
import { getDefaultProjectId } from '../shared/default-project.js';

const str = (v) => (typeof v === 'string' && v !== '' ? v : undefined);

// A named project wins (body, then query), then the one the admin app is working in, then the default.
const requestedProject = requireProject(
  async (req) =>
    str(req.body?.project_id) ??
    str(req.query?.project_id) ??
    str(req.headers?.['x-project-id']) ??
    (await getDefaultProjectId()) ??
    undefined // no project exists at all: requireProject answers 404
);

export const contentProject = () => (req, res, next) =>
  requestedProject(req, res, (err) => {
    if (err) return next(err);
    // A list without a project shows the request project, not every project's rows.
    if (req.method === 'GET' && req.path === '/' && !str(req.query?.project_id)) {
      // Express 5 builds req.query on every read, so the value has to be pinned on the request.
      Object.defineProperty(req, 'query', {
        value: { ...req.query, project_id: req.projectId },
        writable: true,
        configurable: true,
      });
    }
    // A new row lands in the request project instead of in no project.
    if (req.method === 'POST' && req.path === '/' && req.body && !str(req.body.project_id)) {
      req.body.project_id = req.projectId;
    }
    next();
  });

// How to find the project of a row. Most rows have project_id; a menu item belongs to its menu's project.
const LOOKUPS = {
  menuItem: { select: { menu: { select: { project_id: true } } }, project: (row) => row.menu?.project_id },
};
const lookupFor = (model) =>
  LOOKUPS[model] ?? { select: { project_id: true }, project: (row) => row.project_id };

/**
 * router.param handler: the caller must be allowed to use the project of the row `:id` points at.
 * A row with no project (older data) counts as the default project. An unknown id passes through, so the
 * handler answers its usual 404. `itemModel` is used instead when the matched route is an `/items/...` one.
 */
export const recordProject = (model, { itemModel } = {}) =>
  async (req, res, next, id) => {
    try {
      const useModel = itemModel && String(req.route?.path ?? '').startsWith('/items/') ? itemModel : model;
      const { select, project } = lookupFor(useModel);
      const row = await prisma[useModel].findFirst({ where: { id }, select });
      if (!row) return next();
      const projectId = project(row) ?? (await getDefaultProjectId());
      if (!projectId) return next();
      return requireProject(() => projectId)(req, res, next);
    } catch (err) {
      return next(err);
    }
  };
