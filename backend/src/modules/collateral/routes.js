// Collateral routes — COLLATERAL_SPEC.md §7.
// All routes behind moduleGate('collateral') + authenticate + RBAC.
import { Router } from 'express';
import { moduleGate } from '../../middleware/module-gate.js';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { prisma } from '../../config/database.js';
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

// Asset / render routes carry no project id: resolve it from the row, then run the same access check.
const assetProject = requireProject(async (req) => {
  const a = await prisma.collateralAsset.findUnique({ where: { id: req.params.id }, select: { project_id: true } });
  return a?.project_id;
});
const renderProject = requireProject(async (req) => {
  const r = await prisma.collateralRender.findUnique({
    where: { id: req.params.renderId },
    select: { asset: { select: { project_id: true } } },
  });
  return r?.asset?.project_id;
});

// Asset list + create.
router.get('/assets', requirePermission('collateral', 'view'), validate(listAssetsQuerySchema), requireProject('query'), listAssets);
router.post('/assets', requirePermission('collateral', 'edit'), validate(createAssetSchema), requireProject('body'), createAsset);

// Single-asset operations.
router.get('/assets/:id', requirePermission('collateral', 'view'), validate(assetParamSchema), assetProject, getAsset);
router.patch('/assets/:id', requirePermission('collateral', 'edit'), validate(updateAssetSchema), assetProject, updateAsset);
router.delete('/assets/:id', requirePermission('collateral', 'delete'), validate(assetParamSchema), assetProject, deleteAsset);

// Preflight + render (metered — requires render permission).
router.post('/assets/:id/preflight', requirePermission('collateral', 'view'), validate(assetParamSchema), assetProject, preflightAsset);
router.post('/assets/:id/render', requirePermission('collateral', 'render'), validate(renderParamSchema), assetProject, renderAsset);

// Download.
router.get('/renders/:renderId/download', requirePermission('collateral', 'view'), validate(renderIdParamSchema), renderProject, downloadRender);

export default router;
