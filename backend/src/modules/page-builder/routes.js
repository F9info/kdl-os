import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { z } from 'zod';
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

// Admin CRUD — authenticated + RBAC-gated.
router.get('/', authenticate, requirePermission('page-builder', 'view'), getAll);
router.get('/:id', authenticate, requirePermission('page-builder', 'view'), getOne);
router.post('/', authenticate, requirePermission('page-builder', 'add'), postCreate);
// Changing `status` (publish / unpublish) needs the publish permission on top of edit, same as
// the dedicated /publish and /unpublish routes.
const requirePublishWhenStatusSet = (req, res, next) =>
  req.body?.status === undefined ? next() : requirePermission('page-builder', 'publish')(req, res, next);

router.put(
  '/:id',
  authenticate,
  requirePermission('page-builder', 'edit'),
  requirePublishWhenStatusSet,
  putUpdate
);
router.post('/:id/publish', authenticate, requirePermission('page-builder', 'publish'), postPublish);
router.post('/:id/unpublish', authenticate, requirePermission('page-builder', 'publish'), postUnpublish);
router.post('/:id/preview-link', authenticate, requirePermission('page-builder', 'edit'), postPreviewLink);
router.post('/:id/checks', authenticate, requirePermission('page-builder', 'view'), postPageChecks);
router.get('/:id/versions', authenticate, requirePermission('page-builder', 'view'), getVersions);
router.post(
  '/:id/versions/:versionId/restore',
  authenticate,
  requirePermission('page-builder', 'publish'),
  postRestore
);
router.delete('/:id', authenticate, requirePermission('page-builder', 'delete'), remove);

export default router;
