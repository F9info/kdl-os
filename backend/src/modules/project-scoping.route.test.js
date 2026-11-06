/**
 * Project scoping on credits / brand-kit / collateral routes.
 * A caller who is not owner, member, or super-admin of a NON-shared project must get 403 on every
 * route that takes a project (directly, or through an asset / render / hold). A member passes,
 * and an unknown asset or hold is a 404. Routes were previously only permission-gated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const stubs = vi.hoisted(
  () => (names) => Object.fromEntries(names.map((n) => [n, (_req, res) => res.json({ ok: true })]))
);
const db = vi.hoisted(() => ({
  prisma: {
    collateralAsset: { findUnique: vi.fn() },
    collateralRender: { findUnique: vi.fn() },
    creditHold: { findUnique: vi.fn() },
  },
}));
const access = vi.hoisted(() => ({ getProjectForAccessCheck: vi.fn() }));
vi.mock('../config/database.js', () => db);
vi.mock('./projects/service.js', () => access);
vi.mock('./user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ bypass: false, permissions: [] }),
}));
vi.mock('../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => ((req.user = { id: req.get('x-user') ?? 'outsider' }), next()),
}));
vi.mock('../middleware/permission.js', () => ({ requirePermission: () => (_req, _res, next) => next() }));
vi.mock('../middleware/upload.js', () => ({ upload: { single: () => (_req, _res, next) => next() } }));
vi.mock('../middleware/module-gate.js', () => ({ moduleGate: () => (_req, _res, next) => next() }));
vi.mock('../shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
// Handlers must not run for denied callers; for allowed ones a stub is enough.
vi.mock('./credits/controller.js', () => {
  const ok = (_req, res) => res.json({ ok: true });
  return {
    getProjectBalance: ok,
    getProjectLedger: ok,
    getProjectReconciliation: ok,
    postGrant: ok,
    postAdjustment: ok,
    postForceRelease: ok,
  };
});
vi.mock('./brand-kit/controller.js', () =>
  stubs([
    'getKitHandler',
    'uploadLogoHandler',
    'extractHandler',
    'inferHandler',
    'patchKitHandler',
    'approveHandler',
    'reopenHandler',
    'getTokensHandler',
    'getThemeColorsHandler',
    'renderGuidelinesHandler',
  ])
);
vi.mock('./collateral/controller.js', () =>
  stubs([
    'listAssets',
    'createAsset',
    'getAsset',
    'updateAsset',
    'preflightAsset',
    'renderAsset',
    'downloadRender',
    'deleteAsset',
  ])
);
vi.mock('./brand-kit/contact-fields.js', () => ({}));

import credits from './credits/routes.js';
import brandKit from './brand-kit/routes.js';
import collateral from './collateral/routes.js';
import { errorHandler } from '../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/credits', credits);
app.use('/bk', brandKit);
app.use('/col', collateral);
app.use(errorHandler);

const PRIVATE = {
  id: 'p1',
  created_by: 'owner',
  is_shared: false,
  members: [{ user_id: 'member', role: 'EDITOR' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  access.getProjectForAccessCheck.mockResolvedValue(PRIVATE);
  db.prisma.collateralAsset.findUnique.mockResolvedValue({ project_id: 'p1' });
  db.prisma.collateralRender.findUnique.mockResolvedValue({ asset: { project_id: 'p1' } });
  db.prisma.creditHold.findUnique.mockResolvedValue({ project_id: 'p1' });
});

const ROUTES = [
  ['get', '/credits/projects/p1/balance'],
  ['get', '/credits/projects/p1/ledger'],
  ['get', '/credits/projects/p1/reconciliation'],
  ['post', '/credits/projects/p1/grants', { amount: 5, reason: 'x', idempotency_key: 'k1' }],
  ['post', '/credits/holds/h1/release'],
  ['get', '/bk/p1'],
  ['get', '/bk/p1/tokens'],
  ['patch', '/bk/p1', { name: 'x' }],
  ['post', '/bk/p1/reopen'],
  ['get', '/col/assets?projectId=p1'],
  ['get', '/col/assets/a1'],
  ['delete', '/col/assets/a1'],
  ['post', '/col/assets/a1/render', { format: 'PDF_PRINT' }],
  ['get', '/col/renders/r1/download'],
];

const call = (user, [method, url, body]) => request(app)[method](url).set('x-user', user).send(body);

describe('project scoping', () => {
  it.each(ROUTES)('%s %s: outsider is 403 on a private project', async (...route) => {
    const res = await call('outsider', route);
    expect(res.status).toBe(403);
  });

  it.each(ROUTES)('%s %s: member passes the project check', async (...route) => {
    const res = await call('member', route);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(404);
  });

  it('shared project stays open to any signed-in user', async () => {
    access.getProjectForAccessCheck.mockResolvedValue({ ...PRIVATE, is_shared: true });
    expect((await call('outsider', ['get', '/bk/p1'])).status).toBe(200);
  });

  it('unknown asset / render / hold is 404, not a leak', async () => {
    db.prisma.collateralAsset.findUnique.mockResolvedValue(null);
    db.prisma.collateralRender.findUnique.mockResolvedValue(null);
    db.prisma.creditHold.findUnique.mockResolvedValue(null);
    expect((await call('member', ['get', '/col/assets/nope'])).status).toBe(404);
    expect((await call('member', ['get', '/col/renders/nope/download'])).status).toBe(404);
    expect((await call('member', ['post', '/credits/holds/nope/release'])).status).toBe(404);
  });
});
