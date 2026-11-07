import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import { requestProject } from '../../middleware/request-project.js';
import {
  getSchemaQuerySchema,
  getValuesQuerySchema,
  postValuesBodySchema,
  postResetBodySchema,
  postActiveThemeBodySchema,
  postLocksReleaseBodySchema,
  getTokensQuerySchema,
  getVersionsQuerySchema,
  postRestoreVersionSchema,
  putSiteStylesBodySchema,
  createPresetSchema,
  updatePresetSchema,
  presetKeyParams,
  duplicatePresetSchema,
} from './schema.js';
import { getSchema, getValues, postValues, postReset, postActiveTheme, releaseLocks, getTokens, getVersions, postRestoreVersion, getSiteStyles, putSiteStyles, getPresets, postPreset, putPreset, postPresetDuplicate, removePreset } from './controller.js';

const router = Router();

// Public-readable token endpoint (optionalAuthenticate — controller enforces flag check)
router.get('/tokens', optionalAuthenticate, validate(getTokensQuerySchema), getTokens);

// All other routes require authentication and permission
router.get('/schema', authenticate, requirePermission('theme-engine', 'view'), requestProject, validate(getSchemaQuerySchema), getSchema);
router.get('/values', authenticate, requirePermission('theme-engine', 'view'), requestProject, validate(getValuesQuerySchema), getValues);
router.post('/values', authenticate, requirePermission('theme-engine', 'edit'), requestProject, validate(postValuesBodySchema), postValues);
router.post('/reset', authenticate, requirePermission('theme-engine', 'edit'), requestProject, validate(postResetBodySchema), postReset);
router.post('/active-theme', authenticate, requirePermission('theme-engine', 'edit'), requestProject, validate(postActiveThemeBodySchema), postActiveTheme);
router.post('/locks/release', authenticate, requirePermission('theme-engine', 'edit'), validate(postLocksReleaseBodySchema), releaseLocks);
router.get('/versions', authenticate, requirePermission('theme-engine', 'view'), requestProject, validate(getVersionsQuerySchema), getVersions);
router.post('/versions/:id/restore', authenticate, requirePermission('theme-engine', 'edit'), requestProject, validate(postRestoreVersionSchema), postRestoreVersion);

router.get('/site-styles', authenticate, requirePermission('theme-engine', 'view'), requestProject, getSiteStyles);
router.put('/site-styles', authenticate, requirePermission('theme-engine', 'edit'), requestProject, validate(putSiteStylesBodySchema), putSiteStyles);

// Theme presets: the looks offered in the Simple view. Browse, save the current colours, rename, duplicate, delete.
router.get('/presets', authenticate, requirePermission('theme-engine', 'view'), getPresets);
router.post('/presets', authenticate, requirePermission('theme-engine', 'edit'), validate(createPresetSchema), postPreset);
router.put('/presets/:key', authenticate, requirePermission('theme-engine', 'edit'), validate(updatePresetSchema), putPreset);
router.post('/presets/:key/duplicate', authenticate, requirePermission('theme-engine', 'edit'), validate(duplicatePresetSchema), postPresetDuplicate);
router.delete('/presets/:key', authenticate, requirePermission('theme-engine', 'edit'), validate(presetKeyParams), removePreset);

export default router;
