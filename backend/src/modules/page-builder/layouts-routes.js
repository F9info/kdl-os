// T11 routes, mounted by routes.js before the generic /:id routes.
import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requestProject } from '../../middleware/request-project.js';
import { validate } from '../../middleware/validate.js';
import { successResponse } from '../../shared/utils/response.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { duplicatePage, listLayouts, saveAsLayout, createFromLayout } from './layouts.js';

const slug = z.string().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase alphanumeric with hyphens');
const duplicateSchema = z.object({ title: z.string().min(1).max(200).optional(), slug: slug.optional() });
const saveSchema = z.object({ page_id: z.string().min(1), name: z.string().trim().min(1).max(120), description: z.string().max(500).optional() });
const applySchema = z.object({ layout_key: z.string().min(1), title: z.string().min(1).max(200), slug });

// Every handler is wrapped: a service error with a status answers with it, anything else goes to next().
const run = (fn, status = 200) => async (req, res, next) => {
  try {
    successResponse(res, await fn(req), status);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};
const log = (req, action, id, description) =>
  writeActivityAsync({ actor: req.user?.id, module: 'page-builder', action, subject_type: 'BuilderPage', subject_id: id, description });

const router = Router();
router.get('/layouts', authenticate, requirePermission('page-builder', 'view'), run(async () => ({ layouts: await listLayouts() })));
router.post(
  '/layouts',
  authenticate,
  requirePermission('page-builder', 'add'),
  requestProject,
  validate(saveSchema),
  run(async (req) => {
    const layout = await saveAsLayout(req.body.page_id, req.body, req.user?.id, req.projectId);
    log(req, 'layout-saved', req.body.page_id, `Page saved as layout "${layout.name}"`);
    return { layout };
  }, 201)
);
router.post(
  '/from-layout',
  authenticate,
  requirePermission('page-builder', 'add'),
  requestProject,
  validate(applySchema),
  run(async (req) => ({ page: await createFromLayout(req.body, req.user?.id, req.projectId) }), 201)
);
// :id is checked against the request's project inside duplicatePage (a page of another project is a 404).
router.post(
  '/:id/duplicate',
  authenticate,
  requirePermission('page-builder', 'add'),
  requestProject,
  validate(duplicateSchema),
  run(async (req) => ({ page: await duplicatePage(req.params.id, req.body, req.user?.id, req.projectId) }), 201)
);

export default router;
