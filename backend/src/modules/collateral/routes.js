// Collateral routes — COLLATERAL_SPEC.md §7.
// All routes behind moduleGate('collateral') + authenticate + RBAC.
import { Router } from 'express';
import { moduleGate } from '../../middleware/module-gate.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { validate } from '../../middleware/validate.js';
import {
  createAssetSchema,
  listAssetsQuerySchema,
  assetParamSchema,
  updateAssetSchema,
  renderParamSchema,
  renderIdParamSchema,
} from './schema.js';
import {
  listAssets,
  createAsset,
  getAsset,
  updateAsset,
  preflightAsset,
  renderAsset,
  downloadRender,
  deleteAsset,
} from './controller.js';

const router = Router();

router.use(moduleGate('collateral'), authenticate);

// Asset list + create.
router.get('/assets', requirePermission('collateral', 'view'), validate(listAssetsQuerySchema), listAssets);
router.post('/assets', requirePermission('collateral', 'edit'), validate(createAssetSchema), createAsset);

// Single-asset operations.
router.get('/assets/:id', requirePermission('collateral', 'view'), validate(assetParamSchema), getAsset);
router.patch('/assets/:id', requirePermission('collateral', 'edit'), validate(updateAssetSchema), updateAsset);
router.delete('/assets/:id', requirePermission('collateral', 'delete'), validate(assetParamSchema), deleteAsset);

// Preflight + render (metered — requires render permission).
router.post('/assets/:id/preflight', requirePermission('collateral', 'view'), validate(assetParamSchema), preflightAsset);
router.post('/assets/:id/render', requirePermission('collateral', 'render'), validate(renderParamSchema), renderAsset);

// Download.
router.get('/renders/:renderId/download', requirePermission('collateral', 'view'), validate(renderIdParamSchema), downloadRender);

export default router;
