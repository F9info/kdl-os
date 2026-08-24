/**
 * requireProject middleware — KDL-627
 *
 * Verifies X-Project-Id is validated against the real projects module:
 *   1. Unknown project id             → 404
 *   2. Caller does not own project    → 403  (core security assertion)
 *   3. Valid, authorized project      → passes through (req.projectId set)
 *   4. Super-admin bypass             → passes through even if not the creator
 *   5. Missing header                 → 400
 *   6. Mutation route (advanceStage)  → 403 for unauthorised caller
 *
 * Mock-key audit (KDL-577 lesson):
 *   getProjectForAccessCheck is mocked — it returns { id, created_by } matching
 *   backend/prisma/schema/projects.prisma fields (both present).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks before any real imports.
vi.mock('../modules/projects/service.js', () => ({
  getProjectForAccessCheck: vi.fn(),
}));

vi.mock('../modules/user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn(),
}));

import { getProjectForAccessCheck } from '../modules/projects/service.js';
import { resolvePermissions } from '../modules/user-management/shared/permission-resolver.js';
import { requireProject } from './project.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq({ projectIdHeader, userId, userPermissions } = {}) {
  return {
    headers: projectIdHeader !== undefined ? { 'x-project-id': projectIdHeader } : {},
    user: userId !== undefined ? { id: userId } : undefined,
    userPermissions: userPermissions ?? null,
  };
}

function makeRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const CALLER_ID  = 'user-abc';
const OTHER_ID   = 'user-xyz';
const PROJECT_ID = 'proj-1';

function notFoundError() {
  const err = new Error('Project not found');
  err.status = 404;
  return err;
}

const ownedProject   = { id: PROJECT_ID, created_by: CALLER_ID };
const foreignProject = { id: PROJECT_ID, created_by: OTHER_ID };

// ── Test cases ─────────────────────────────────────────────────────────────────

describe('requireProject middleware', () => {
  let next;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });
  });

  // ── 1. Unknown project id → 404 ─────────────────────────────────────────────

  it('returns 404 when project does not exist', async () => {
    getProjectForAccessCheck.mockRejectedValue(notFoundError());

    const req = makeReq({ projectIdHeader: 'nonexistent-id', userId: CALLER_ID });
    const res = makeRes();

    await requireProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 2. Valid project id, caller does not own → 403 (core security check) ────

  it('returns 403 when project exists but caller does not own it', async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 3. Valid, authorized project id → passes through ────────────────────────

  it('calls next and sets req.projectId for project owner', async () => {
    getProjectForAccessCheck.mockResolvedValue(ownedProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── 4. Super-admin bypass → passes through regardless of creator ─────────────

  it('calls next for super-admin user even when not the project creator', async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject);
    resolvePermissions.mockResolvedValue({ bypass: true, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
  });

  // ── 5. Missing header → 400 ──────────────────────────────────────────────────

  it('returns 400 when X-Project-Id header is absent', async () => {
    const req = makeReq({ userId: CALLER_ID }); // no projectIdHeader key
    const res = makeRes();

    await requireProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getProjectForAccessCheck).not.toHaveBeenCalled();
  });

  // ── 6. Mutation route — 403 on unauthorised caller ───────────────────────────
  // The mutation path (advanceStage, retryStage, etc.) is the actual security hole
  // described in KDL-606/KDL-627. This test simulates that call context.

  it('blocks an unauthorised mutation caller with 403', async () => {
    // Simulates POST /runs/:runId/stages/:stage/advance with a foreign project id.
    getProjectForAccessCheck.mockResolvedValue(foreignProject); // project owned by OTHER_ID
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: ['template-engine:run'] });

    const req = {
      headers: { 'x-project-id': PROJECT_ID },
      user: { id: CALLER_ID },   // caller != project.created_by
      userPermissions: null,     // will be resolved by middleware
      validated: {
        params: { runId: 'run-1', stage: 'intake' },
      },
    };
    const res = makeRes();

    await requireProject(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── Uses cached req.userPermissions if already loaded ────────────────────────

  it('skips resolvePermissions call when req.userPermissions is already set', async () => {
    getProjectForAccessCheck.mockResolvedValue(ownedProject);

    const req = makeReq({
      projectIdHeader: PROJECT_ID,
      userId: CALLER_ID,
      userPermissions: { bypass: false, permissions: [] },
    });
    const res = makeRes();

    await requireProject(req, res, next);

    expect(resolvePermissions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
