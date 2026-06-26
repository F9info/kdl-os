import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import { listSettingsSchema, getSettingSchema, createSettingSchema, updateSettingSchema, deleteSettingSchema } from './schema.js';
import { listSettings, getSetting, createSetting, updateSetting, deleteSetting } from './controller.js';

const router = Router();

router.get('/', optionalAuthenticate, validate(listSettingsSchema), listSettings);
router.get('/:key', optionalAuthenticate, validate(getSettingSchema), getSetting);

router.post('/', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(createSettingSchema), createSetting);
router.patch('/:key', authenticate, requireRole('ADMIN', 'SUPER_ADMIN'), validate(updateSettingSchema), updateSetting);
router.delete('/:key', authenticate, requireRole('SUPER_ADMIN'), validate(deleteSettingSchema), deleteSetting);

export default router;
