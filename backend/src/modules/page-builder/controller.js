import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { createPageSchema, updatePageSchema } from './schema.js';
import * as service from './service.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { prisma } from '../../config/database.js';
import { getSiteLayout } from '../projects/layout.js';
import { resolvePublicSite } from '../projects/sites.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await service.listPages();
    successResponse(res, { items });
  } catch (err) {
    next(err);
  }
};

export const getOne = async (req, res, next) => {
  try {
    const page = await service.getPage(req.params.id);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page });
  } catch (err) {
    next(err);
  }
};

// Public — no auth. Only returns PUBLISHED pages.
// The project's saved header/footer layout rides along with the public page, so visitors' browsers
// apply it at render time (T4.2). null when the project never saved one.
const withLayout = async (page) => ({
  ...page,
  layout: page.project_id ? await getSiteLayout(page.project_id) : null,
});

export const getPublic = async (req, res, next) => {
  try {
    const page = await service.getPublishedBySlug(req.params.slug);
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page: await withLayout(page) });
  } catch (err) {
    next(err);
  }
};

// "/" and "/<key>". The site comes from the request host (a site's custom domain), else the optional
// ?site=<slug> of the project, else the project's default site. `?host=` lets the Next server
// (which fetches on a visitor's behalf) pass the visitor's host along.
const queryString = (v) => (typeof v === 'string' && v !== '' ? v : undefined);

export const getPublicSitePage = async (req, res, next) => {
  try {
    const site = await resolvePublicSite(prisma, {
      host: queryString(req.query.host) ?? req.get('x-forwarded-host') ?? req.get('host'),
      siteSlug: queryString(req.query.site),
      projectId: queryString(req.query.project_id) ?? (await getDefaultProjectId(prisma)),
    });
    const page = site && (await service.getPublishedBySiteKey(site.projectId, req.params.key, site));
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page: await withLayout(page) });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const data = createPageSchema.parse(req.body);
    const page = await service.createPage(data, req.user?.id);
    successResponse(res, { page }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const patch = updatePageSchema.parse(req.body);
    const page = await service.updatePage(req.params.id, patch, req.user?.id);
    successResponse(res, { page });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    await service.deletePage(req.params.id, req.user?.id);
    successResponse(res, { ok: true });
  } catch (err) {
    next(err);
  }
};
