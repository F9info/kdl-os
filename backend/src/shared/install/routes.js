import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { writeActivity, getClientIp } from '../../modules/user-management/shared/activity-logger.js';
import { isInstalled } from './status.js';
import { companySchema, typeSchema } from './schema.js';
import * as svc from './service.js';

const router = Router();
const run = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    // 4xx are the caller's to fix; a stopped install is reported with its reason.
    if (err.status && (err.status < 500 || err.message.startsWith('Installation stopped'))) {
      return errorResponse(res, err.message, err.status);
    }
    next(err);
  }
};

// The wizard has no login, so it is capped per address, and every write refuses once installed.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again in a few minutes.' },
});
const openOnly = async (req, res, next) => {
  try {
    if (await isInstalled()) return errorResponse(res, 'Installation is already complete', 409);
    next();
  } catch (err) {
    next(err);
  }
};

router.get('/status', run(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  return successResponse(res, await svc.getState());
}));
router.get('/app-types', limiter, openOnly, run(async (req, res) => successResponse(res, await svc.typeCatalog())));
router.post('/logo', limiter, openOnly, upload.single('file'), run(async (req, res) => successResponse(res, await svc.saveLogo(req.file), 201)));
router.put('/company', limiter, openOnly, validate(companySchema), run(async (req, res) => successResponse(res, await svc.saveCompany(req.validated.body))));
router.put('/app-type', limiter, openOnly, validate(typeSchema), run(async (req, res) => successResponse(res, await svc.saveType(req.validated.body.app_type))));
router.post('/complete', limiter, run(async (req, res) => successResponse(res, await svc.complete())));

// After login (Super Admin / Developer through the settings + modules permissions).
router.get('/config', authenticate, requirePermission('settings', 'view'), run(async (req, res) => successResponse(res, await svc.currentType())));
router.put(
  '/config/app-type',
  authenticate,
  requirePermission('settings', 'edit'),
  requirePermission('modules', 'add'),
  requirePermission('modules', 'edit'),
  validate(typeSchema),
  run(async (req, res) => {
    const result = await svc.changeType(req.validated.body.app_type, req.user.id);
    try {
      writeActivity({
        actor: req.user.id,
        module: 'settings',
        action: 'updated',
        subject_type: 'ApplicationType',
        subject_id: 'install.app_type',
        description: `Application type set to ${result.type}`,
        properties: { previous: result.previous, modules: result.added_or_enabled },
        ip_address: getClientIp(req),
      });
    } catch {
      // a logging failure must never break the response
    }
    return successResponse(res, result);
  })
);

export default router;
