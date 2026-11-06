import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/permission.js';
import { requireProject } from '../../middleware/project.js';
import { validate } from '../../middleware/validate.js';
import { prisma } from '../../config/database.js';
import { grantSchema, adjustSchema, ledgerQuerySchema } from './schema.js';
import {
  getProjectBalance,
  getProjectLedger,
  getProjectReconciliation,
  postGrant,
  postAdjustment,
  postForceRelease,
} from './controller.js';

const router = Router();

// Read / admin surface per CREDITS_ARCH §7.
// No POST /preflight — withdrawn per CEO ruling (KDL-453 OI-4).

router.get(
  '/projects/:projectId/balance',
  authenticate,
  requirePermission('credits', 'view'),
  requireProject('param'),
  getProjectBalance,
);

router.get(
  '/projects/:projectId/ledger',
  authenticate,
  requirePermission('credits', 'view'),
  requireProject('param'),
  validate(ledgerQuerySchema),
  getProjectLedger,
);

router.get(
  '/projects/:projectId/reconciliation',
  authenticate,
  requirePermission('credits', 'view'),
  requireProject('param'),
  getProjectReconciliation,
);

router.post(
  '/projects/:projectId/grants',
  authenticate,
  requirePermission('credits', 'manage'),
  requireProject('param'),
  validate(grantSchema),
  postGrant,
);

router.post(
  '/projects/:projectId/adjustments',
  authenticate,
  requirePermission('credits', 'manage'),
  requireProject('param'),
  validate(adjustSchema),
  postAdjustment,
);

router.post(
  '/holds/:holdId/release',
  authenticate,
  requirePermission('credits', 'manage'),
  requireProject(async (req) => {
    const hold = await prisma.creditHold.findUnique({ where: { id: req.params.holdId }, select: { project_id: true } });
    return hold?.project_id;
  }),
  postForceRelease,
);

export default router;
