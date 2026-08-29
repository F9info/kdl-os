import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import { listAccessibleProjectIds } from '../projects/service.js';
import { resolvePermissions } from '../user-management/shared/permission-resolver.js';
import {
  createCustomBlockSchema,
  listCustomBlocksQuerySchema,
  customBlockIdParamSchema,
  updateCustomBlockSchema,
} from './schema.js';
import {
  getAll,
  postCreate,
  putUpdate,
  postDuplicate,
  postSetDefault,
  remove,
} from './controller.js';

const router = Router();

router.use(authenticate);

// The legacy Page Builder editor has no project context, so it omits
// projectId — but the list must still never cross tenant boundaries.
// When projectId IS given, behave exactly like every other route
// (requireProject validates access to that one project). When it's
// omitted, resolve every project this caller can actually access (same
// is_shared/owner/member rule requireProject checks per-project — or every
// project for a super-admin) and scope the query to that set instead of
// removing scoping entirely.
async function scopeProjectForList(req, res, next) {
  if (req.validated.query.projectId) return requireProject('query')(req, res, next);
  try {
    const perms = req.userPermissions ?? (await resolvePermissions(req.user?.id));
    req.accessibleProjectIds = perms.bypass ? null : await listAccessibleProjectIds(req.user?.id);
    next();
  } catch (err) {
    next(err);
  }
}

router.get(
  '/',
  requirePermission('page-builder', 'view'),
  validate(listCustomBlocksQuerySchema),
  scopeProjectForList,
  getAll
);
router.post(
  '/',
  requirePermission('page-builder', 'add'),
  validate(createCustomBlockSchema),
  requireProject('body'),
  postCreate
);
router.put(
  '/:id',
  requirePermission('page-builder', 'edit'),
  validate(updateCustomBlockSchema),
  requireProject(),
  putUpdate
);
router.post(
  '/:id/duplicate',
  requirePermission('page-builder', 'add'),
  validate(customBlockIdParamSchema),
  requireProject(),
  postDuplicate
);
router.post(
  '/:id/set-default',
  requirePermission('page-builder', 'edit'),
  validate(customBlockIdParamSchema),
  requireProject(),
  postSetDefault
);
router.delete(
  '/:id',
  requirePermission('page-builder', 'delete'),
  validate(customBlockIdParamSchema),
  requireProject(),
  remove
);

export default router;
