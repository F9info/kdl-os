import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { friendlyLinksFor } from '../../shared/page-routes-db.js';
import { createPageSchema, updatePageSchema, publishPageSchema } from './schema.js';
import * as service from './service.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { prisma } from '../../config/database.js';
import { getSiteLayout } from '../projects/layout.js';
import { resolvePublicSite } from '../projects/sites.js';
import { getPublicSiteIdentity } from '../projects/site-identity.js';
import { getPublicSeo, getSeoDefaults, saveSeoDefaults } from './seo.js';
import { createPreviewLink, getPreviewPage, previewLinkSchema } from './preview.js';

export const getAll = async (req, res, next) => {
  try {
    const items = await service.listPages(req.projectId);
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
// What rides along with a public page so visitors' browsers can finish rendering it: the project's
// saved header/footer layout (T4.2), the site's identity overrides (T5.5) and the SEO for its <head>
// (T6.1: `seo` = the page's own, `seoDefaults` = site-wide), each null when there is none.
const withLayout = async ({ site_id: siteId, ...page }) => ({
  ...page,
  // Links saved as /p/<slug> in the page and its layout are given the routes the site serves (shared/page-routes.js).
  data: await friendlyLinksFor(page.project_id, page.data),
  layout: page.project_id ? await friendlyLinksFor(page.project_id, await getSiteLayout(page.project_id)) : null,
  identity: await getPublicSiteIdentity(siteId),
  ...(await getPublicSeo(page.seo)),
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

// The site a public request is for (see resolvePublicSite), or null.
const requestSite = async (req) =>
  resolvePublicSite(prisma, {
    host: queryString(req.query.host) ?? req.get('x-forwarded-host') ?? req.get('host'),
    siteSlug: queryString(req.query.site),
    projectId: queryString(req.query.project_id) ?? (await getDefaultProjectId(prisma)),
  });

export const getPublicSitePage = async (req, res, next) => {
  try {
    const site = await requestSite(req);
    const page = site && (await service.getPublishedBySiteKey(site.projectId, req.params.key, site));
    if (!page) return errorResponse(res, 'Page not found', 404);
    successResponse(res, { page: await withLayout(page) });
  } catch (err) {
    next(err);
  }
};

// Paths of the site's indexable published pages, for the frontend's sitemap.xml.
export const getPublicSitemap = async (req, res, next) => {
  try {
    const site = await requestSite(req);
    if (!site) return errorResponse(res, 'Site not found', 404);
    successResponse(res, { entries: await service.listSitemapEntries(site.projectId, site) });
  } catch (err) {
    next(err);
  }
};

export const getSeoDefaultsHandler = async (_req, res, next) => {
  try {
    successResponse(res, { defaults: await getSeoDefaults() });
  } catch (err) {
    next(err);
  }
};

export const putSeoDefaultsHandler = async (req, res, next) => {
  try {
    successResponse(res, { defaults: await saveSeoDefaults(req.validated.body) });
  } catch (err) {
    next(err);
  }
};

export const postCreate = async (req, res, next) => {
  try {
    const parsed = createPageSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 422, parsed.error.flatten());
    // The project comes from the request (checked by requestProject), never from the body.
    const page = await service.createPage({ ...parsed.data, project_id: req.projectId }, req.user?.id);
    successResponse(res, { page }, 201);
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

export const putUpdate = async (req, res, next) => {
  try {
    const parsed = updatePageSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 'Validation failed', 422, parsed.error.flatten());
    const page = await service.updatePage(req.params.id, parsed.data, req.user?.id);
    successResponse(res, { page });
  } catch (err) {
    if (err.status) return errorResponse(res, err.message, err.status);
    next(err);
  }
};

// Publish workflow (T6.2). Bodies are validated; service errors carry an HTTP status.
const sendError = (res, err, next) =>
  err.status ? errorResponse(res, err.message, err.status, err.errors) : next(err);

export const postPublish = async (req, res, next) => {
  try {
    const parsed = publishPageSchema.safeParse(req.body ?? {});
    if (!parsed.success) return errorResponse(res, 'Validation failed', 422, parsed.error.flatten());
    successResponse(res, { page: await service.publish(req.params.id, parsed.data, req.user?.id) });
  } catch (err) {
    sendError(res, err, next);
  }
};

export const postPageChecks = async (req, res, next) => {
  try {
    const parsed = publishPageSchema.omit({ force: true }).safeParse(req.body ?? {});
    if (!parsed.success) return errorResponse(res, 'Validation failed', 422, parsed.error.flatten());
    successResponse(res, await service.checkPage(req.params.id, parsed.data));
  } catch (err) {
    sendError(res, err, next);
  }
};

export const postUnpublish = async (req, res, next) => {
  try {
    successResponse(res, { page: await service.unpublish(req.params.id, req.user?.id) });
  } catch (err) {
    sendError(res, err, next);
  }
};

export const getVersions = async (req, res, next) => {
  try {
    successResponse(res, { versions: await service.listVersions(req.params.id) });
  } catch (err) {
    sendError(res, err, next);
  }
};

export const postRestore = async (req, res, next) => {
  try {
    successResponse(res, { page: await service.restore(req.params.id, req.params.versionId, req.user?.id) });
  } catch (err) {
    sendError(res, err, next);
  }
};

// Signed preview links (T6.3).
export const postPreviewLink = async (req, res, next) => {
  try {
    const parsed = previewLinkSchema.safeParse(req.body ?? {});
    if (!parsed.success) return errorResponse(res, 'Validation failed', 422, parsed.error.flatten());
    successResponse(res, await createPreviewLink(req.params.id, parsed.data.ttl_hours));
  } catch (err) {
    sendError(res, err, next);
  }
};

// Public, unauthenticated: the token is the credential. Never cached, never indexed.
export const getPublicPreview = async (req, res, next) => {
  try {
    res.set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
    successResponse(res, { page: await withLayout(await getPreviewPage(req.params.token)) });
  } catch (err) {
    sendError(res, err, next);
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
