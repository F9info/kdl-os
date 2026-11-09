import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { requireProject } from '../../middleware/project.js';
import { requestProject } from '../../middleware/request-project.js';
import { prisma } from '../../config/database.js';
import { z } from 'zod';
import layoutsRouter from './layouts-routes.js';
import { seoDefaultsSchema } from './seo.js';
import {
  getAll,
  getOne,
  getPublic,
  getPublicSitePage,
  getPublicSitemap,
  getPublicPreview,
  postPreviewLink,
  getSeoDefaultsHandler,
  putSeoDefaultsHandler,
  postCreate,
  postPublish,
  postUnpublish,
  postRestore,
  getVersions,
  postPageChecks,
  putUpdate,
  remove,
} from './controller.js';

const router = Router();

// Public read of a PUBLISHED page (consumed by the /p/[slug] renderer).
router.get('/public/site/:key', getPublicSitePage);
router.get('/public/sitemap', getPublicSitemap); // before /public/:slug
// Preview links: the token is the credential, so guessing is rate limited per IP.
const previewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
});
router.get('/public/preview/:token', previewLimiter, getPublicPreview);
router.get('/public/:slug', getPublic);

// Site-wide SEO defaults (title template, default share image). Before /:id.
router.get('/seo/defaults', authenticate, requirePermission('settings', 'view'), getSeoDefaultsHandler);
router.put(
  '/seo/defaults',
  authenticate,
  requirePermission('settings', 'edit'),
  validate(z.object({ body: seoDefaultsSchema })),
  putSeoDefaultsHandler
);

// Routes addressed by page id: the caller must be allowed to use the page's own project
// (404 for an unknown page, 403 for another project's page).
const pageProject = requireProject(
  async (req) =>
    (await prisma.builderPage.findFirst({ where: { id: req.params.id }, select: { project_id: true } }))?.project_id
);

// Admin CRUD — authenticated + RBAC-gated.
router.use(layoutsRouter); // duplicate + layouts (T11), before the generic /:id routes
router.get('/', authenticate, requirePermission('page-builder', 'view'), requestProject, getAll);
router.get('/:id', authenticate, requirePermission('page-builder', 'view'), pageProject, getOne);
router.post('/', authenticate, requirePermission('page-builder', 'add'), requestProject, postCreate);
// Changing `status` (publish / unpublish) needs the publish permission on top of edit, same as
// the dedicated /publish and /unpublish routes.
const requirePublishWhenStatusSet = (req, res, next) =>
  req.body?.status === undefined ? next() : requirePermission('page-builder', 'publish')(req, res, next);

router.put(
  '/:id',
  authenticate,
  requirePermission('page-builder', 'edit'),
  requirePublishWhenStatusSet,
  pageProject,
  putUpdate
);
router.post('/:id/publish', authenticate, requirePermission('page-builder', 'publish'), pageProject, postPublish);
router.post('/:id/unpublish', authenticate, requirePermission('page-builder', 'publish'), pageProject, postUnpublish);
router.post('/:id/preview-link', authenticate, requirePermission('page-builder', 'edit'), pageProject, postPreviewLink);
router.post('/:id/checks', authenticate, requirePermission('page-builder', 'view'), pageProject, postPageChecks);
router.get('/:id/versions', authenticate, requirePermission('page-builder', 'view'), pageProject, getVersions);
router.post(
  '/:id/versions/:versionId/restore',
  authenticate,
  requirePermission('page-builder', 'publish'),
  pageProject,
  postRestore
);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), pageProject, remove);

export default router;
