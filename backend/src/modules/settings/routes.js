import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { listSettingsSchema, getSettingSchema, createSettingSchema, updateSettingSchema, deleteSettingSchema } from './schema.js';
import { listSettings, getSetting, createSetting, updateSetting, deleteSetting } from './controller.js';

const router = Router();

router.get('/', optionalAuthenticate, validate(listSettingsSchema), listSettings);
router.get('/:key', optionalAuthenticate, validate(getSettingSchema), getSetting);

router.post('/', authenticate, requirePermission('settings', 'add'), validate(createSettingSchema), createSetting);
router.patch('/:key', authenticate, requirePermission('settings', 'edit'), validate(updateSettingSchema), updateSetting);
router.delete('/:key', authenticate, requirePermission('settings', 'delete'), validate(deleteSettingSchema), deleteSetting);

export default router;
