import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createFormSchema,
  updateFormSchema,
  idParamSchema,
  slugParamSchema,
  submissionsQuerySchema,
} from './schema.js';
import {
  handleList,
  handleCreate,
  handleUpdate,
  handleDelete,
  handleSubmissions,
  handlePublicGet,
  handlePublicSubmit,
} from './controller.js';

const router = Router();

// Public: the ContactForm block reads a form and posts to it. Submissions are rate limited per IP.
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 10 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});
router.get('/public/:slug', validate(slugParamSchema), handlePublicGet);
router.post('/public/:slug/submit', submitLimiter, validate(slugParamSchema), handlePublicSubmit);

// Admin CRUD: authenticated + RBAC-gated.
router.use(authenticate);
router.get('/', requirePermission('forms', 'view'), handleList);
router.post('/', requirePermission('forms', 'add'), validate(createFormSchema), handleCreate);
router.patch('/:id', requirePermission('forms', 'edit'), validate(updateFormSchema), handleUpdate);
router.delete('/:id', requirePermission('forms', 'delete'), validate(idParamSchema), handleDelete);
router.get(
  '/:id/submissions',
  requirePermission('forms', 'view'),
  validate(submissionsQuerySchema),
  handleSubmissions
);

export default router;
