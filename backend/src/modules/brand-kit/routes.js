// Brand-Kit API routes
// Mounted at /api/brand-kit by the module-loader (non-core, behind moduleGate).
//
// OQ-E (CEO ruling): projectId UNIQUE for v1.
// Future multi-kit path: /api/brand-kit/:projectId/kits/:kitId
// with these paths aliasing the active kit — additive, non-breaking.

import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
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
  renderGuidelinesHandler,
} from './controller.js';

const router = Router();

// ── Read ─────────────────────────────────────────────────────────────────────

router.get(
  '/:projectId',
  authenticate, requirePermission('brand-kit', 'view'),
  validate(getKitSchema),
  getKitHandler,
);

// D-BK-6: GET .../tokens returns the payload shaped exactly for
// POST /api/theme-engine/values. brand-kit NEVER writes theme tokens itself.
router.get(
  '/:projectId/tokens',
  authenticate, requirePermission('brand-kit', 'view'),
  validate(getTokensSchema),
  getTokensHandler,
);

// ── Write ────────────────────────────────────────────────────────────────────

router.post(
  '/:projectId/logo',
  authenticate, requirePermission('brand-kit', 'edit'),
  upload.single('file'),
  validate(uploadLogoSchema),
  uploadLogoHandler,
);

router.post(
  '/:projectId/extract',
  authenticate, requirePermission('brand-kit', 'edit'),
  validate(extractSchema),
  extractHandler,
);

// Phase 1: /infer always uses rule-table fallback (no AI key).
// Phase 2 (KDL-483) will call POST /api/ai/brand-inference first.
router.post(
  '/:projectId/infer',
  authenticate, requirePermission('brand-kit', 'edit'),
  validate(inferSchema),
  inferHandler,
);

router.patch(
  '/:projectId',
  authenticate, requirePermission('brand-kit', 'edit'),
  validate(patchKitSchema),
  patchKitHandler,
);

router.post(
  '/:projectId/approve',
  authenticate, requirePermission('brand-kit', 'approve'),
  validate(approveSchema),
  approveHandler,
);

router.post(
  '/:projectId/reopen',
  authenticate, requirePermission('brand-kit', 'edit'),
  validate(getKitSchema),
  reopenHandler,
);

router.post(
  '/:projectId/guidelines/render',
  authenticate, requirePermission('brand-kit', 'render'),
  validate(renderGuidelinesSchema),
  renderGuidelinesHandler,
);

export default router;
