import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { getSettings, updateSettings, testConnection } from './controller.js';
import { updateStorageSettingsSchema, testStorageConnectionSchema } from './schema.js';

const router = Router();

router.use(authenticate);

router.get('/', requirePermission('settings', 'view'), getSettings);
router.put('/', requirePermission('settings', 'edit'), validate(updateStorageSettingsSchema), updateSettings);
router.post('/test', requirePermission('settings', 'edit'), validate(testStorageConnectionSchema), testConnection);

export default router;
