import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  getSchemaQuerySchema,
  getValuesQuerySchema,
  postValuesBodySchema,
  postResetBodySchema,
  postActiveThemeBodySchema,
  getTokensQuerySchema,
} from './schema.js';
import { getSchema, getValues, postValues, postReset, postActiveTheme, getTokens } from './controller.js';

const router = Router();

// Public-readable token endpoint (optionalAuthenticate — controller enforces flag check)
router.get('/tokens', optionalAuthenticate, validate(getTokensQuerySchema), getTokens);

// All other routes require authentication and permission
router.get('/schema', authenticate, requirePermission('theme-engine', 'view'), validate(getSchemaQuerySchema), getSchema);
router.get('/values', authenticate, requirePermission('theme-engine', 'view'), validate(getValuesQuerySchema), getValues);
router.post('/values', authenticate, requirePermission('theme-engine', 'edit'), validate(postValuesBodySchema), postValues);
router.post('/reset', authenticate, requirePermission('theme-engine', 'edit'), validate(postResetBodySchema), postReset);
router.post('/active-theme', authenticate, requirePermission('theme-engine', 'edit'), validate(postActiveThemeBodySchema), postActiveTheme);

export default router;
