import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { updateIdentitySchema } from './schema.js';
import { getAppConfig, getIdentity, updateIdentity } from './controller.js';

// Admin router — mounted at /api/identity
const router = Router();
router.get('/', authenticate, requirePermission('settings', 'view'), getIdentity);
router.put('/', authenticate, requirePermission('settings', 'edit'), validate(updateIdentitySchema), updateIdentity);

// Public router — mounted at /api/app-config (no auth; whitelisted fields only)
export const publicRouter = Router();
publicRouter.get('/', getAppConfig);

export default router;
