import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { writeActivity, getClientIp } from '../../modules/user-management/shared/activity-logger.js';
import { isInstalled } from './status.js';
import { companySchema, typeSchema, adminSchema, modulesSchema } from './schema.js';
import { moduleChoices, saveModules } from './modules.js';

import { databaseStatus } from './database.js';
import { saveAdmin, runCore } from './core.js';
import { readSteps, readLog, markStep, logInstall } from './progress.js';
import * as svc from './service.js';

const router = Router();
const run = (fn) => async (req, res, next) => {
  try {
    return await fn(req, res);
  } catch (err) {
    // 4xx are the caller's to fix; a stopped install is reported with its reason.
    if (err.status && (err.status < 500 || /^(Installation|Core installation) stopped/.test(err.message))) {
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

// No login and no token: the wizard is open until the install completes, then every write is refused (409).
const guarded = [limiter, openOnly];

router.get('/status', run(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  return successResponse(res, await svc.getState());
}));
router.get('/database', ...guarded, run(async (req, res) => {
  const db = await databaseStatus();
  await markStep('database', { status: db.ready ? 'done' : 'failed' });
  await logInstall('database', db.ready ? 'info' : 'error', db.ready ? `connected to ${db.database} on ${db.host}, migrations applied` : `database not ready: ${db.error ?? `${db.migrations?.pending} pending / ${db.migrations?.failed} failed migrations`}`);
  return successResponse(res, db);
}));
router.get('/progress', ...guarded, run(async (req, res) => successResponse(res, { steps: await readSteps(), log: await readLog(60) })));
router.get('/app-types', ...guarded, run(async (req, res) => successResponse(res, await svc.typeCatalog())));
router.post('/logo', ...guarded, upload.single('file'), run(async (req, res) => successResponse(res, await svc.saveLogo(req.file), 201)));
router.put('/company', ...guarded, validate(companySchema), run(async (req, res) => successResponse(res, await svc.saveCompany(req.validated.body))));
router.put('/admin', ...guarded, validate(adminSchema), run(async (req, res) => {
  const { name, email, password } = req.validated.body;
  return successResponse(res, await saveAdmin({ name, email, password }));
}));
router.post('/core', ...guarded, run(async (req, res) => successResponse(res, await runCore())));
router.put('/app-type', ...guarded, validate(typeSchema), run(async (req, res) => successResponse(res, await svc.saveType(req.validated.body.app_type))));
router.get('/modules', ...guarded, run(async (req, res) => {
  const type = req.query.type || (await svc.selectedType());
  return successResponse(res, await moduleChoices(String(type ?? '')));
}));
router.put('/modules', ...guarded, validate(modulesSchema), run(async (req, res) => successResponse(res, await saveModules(await svc.selectedType(), req.validated.body))));
router.post('/complete', ...guarded, run(async (req, res) => successResponse(res, await svc.complete())));

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
