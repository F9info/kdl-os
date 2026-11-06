// Brand-Kit API routes
// Mounted at /api/brand-kit by the module-loader (non-core, behind moduleGate).
//
// OQ-E (CEO ruling): projectId UNIQUE for v1.
// Future multi-kit path: /api/brand-kit/:projectId/kits/:kitId
// with these paths aliasing the active kit — additive, non-breaking.

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import { upload } from '../../middleware/upload.js';
import {
  getKitSchema,
  uploadLogoSchema,
  extractSchema,
  inferSchema,
  patchKitSchema,
  approveSchema,
  getTokensSchema,
  getThemeColorsSchema,
  renderGuidelinesSchema,
} from './schema.js';
import {
  getKitHandler,
  uploadLogoHandler,
  extractHandler,
  inferHandler,
  patchKitHandler,
  approveHandler,
  reopenHandler,
  getTokensHandler,
  getThemeColorsHandler,
  renderGuidelinesHandler,
} from './controller.js';

const router = Router();

// ── Read ─────────────────────────────────────────────────────────────────────

router.get(
  '/:projectId',
  authenticate, requirePermission('brand-kit', 'view'),
  requireProject('param'),
  validate(getKitSchema),
  getKitHandler,
);

// D-BK-6: GET .../tokens returns the payload shaped exactly for
// POST /api/theme-engine/values. brand-kit NEVER writes theme tokens itself.
router.get(
  '/:projectId/tokens',
  authenticate, requirePermission('brand-kit', 'view'),
  requireProject('param'),
  validate(getTokensSchema),
  getTokensHandler,
);

// The brand as the theme's semantic light/dark colours — the Simple Theme view's
// "Use my Brand Kit colours". Read-only; the approval driver is what writes them.
router.get(
  '/:projectId/theme-colors',
  authenticate, requirePermission('brand-kit', 'view'),
  requireProject('param'),
  validate(getThemeColorsSchema),
  getThemeColorsHandler,
);

// ── Write ────────────────────────────────────────────────────────────────────

router.post(
  '/:projectId/logo',
  authenticate, requirePermission('brand-kit', 'edit'),
  requireProject('param'),
  upload.single('file'),
  validate(uploadLogoSchema),
  uploadLogoHandler,
);

router.post(
  '/:projectId/extract',
  authenticate, requirePermission('brand-kit', 'edit'),
  requireProject('param'),
  validate(extractSchema),
  extractHandler,
);

// Phase 1: /infer always uses rule-table fallback (no AI key).
// Phase 2 (KDL-483) will call POST /api/ai/brand-inference first.
router.post(
  '/:projectId/infer',
  authenticate, requirePermission('brand-kit', 'edit'),
  requireProject('param'),
  validate(inferSchema),
  inferHandler,
);

router.patch(
  '/:projectId',
  authenticate, requirePermission('brand-kit', 'edit'),
  requireProject('param'),
  validate(patchKitSchema),
  patchKitHandler,
);

router.post(
  '/:projectId/approve',
  authenticate, requirePermission('brand-kit', 'approve'),
  requireProject('param'),
  validate(approveSchema),
  approveHandler,
);

router.post(
  '/:projectId/reopen',
  authenticate, requirePermission('brand-kit', 'edit'),
  requireProject('param'),
  validate(getKitSchema),
  reopenHandler,
);

router.post(
  '/:projectId/guidelines/render',
  authenticate, requirePermission('brand-kit', 'render'),
  requireProject('param'),
  validate(renderGuidelinesSchema),
  renderGuidelinesHandler,
);

export default router;
