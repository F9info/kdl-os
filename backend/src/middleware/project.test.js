/**
 * requireProject middleware — KDL-627, KDL-635
 *
 * Access model (KDL-635): owner OR member OR super-admin OR shared-project.
 *
 * Covered cases:
 *   1.  Unknown project id                  → 404
 *   2.  Non-member, non-owner               → 403  (core security assertion)
 *   3.  Project owner                       → 200
 *   4.  Super-admin bypass                  → 200  (even when not owner/member)
 *   5.  Missing header                      → 400
 *   6.  Mutation route, unauthorised caller → 403
 *   7.  is_shared=true (org-shared)         → 200  (any authenticated user)
 *   8.  requireProject('body')              → reads projectId from req.validated.body
 *   9.  requireProject('query')             → reads projectId from req.validated.query
 *   10. Explicit project member             → 200  (non-owner with membership row)
 *   11. Member on mutation route            → 200  (member can mutate)
 *
 * Mock-key audit (KDL-577 lesson):
 *   getProjectForAccessCheck is mocked — it returns:
 *     { id, created_by, is_shared, members: [{ user_id, role }] }
 *   All fields match backend/prisma/schema/projects.prisma exactly.
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

function makeReq({ projectIdHeader, userId, userPermissions, body, query } = {}) {
  return {
    headers: projectIdHeader !== undefined ? { 'x-project-id': projectIdHeader } : {},
    user: userId !== undefined ? { id: userId } : undefined,
    userPermissions: userPermissions ?? null,
    validated: {
      body: body ?? {},
      query: query ?? {},
    },
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
const MEMBER_ID  = 'user-member-001';
const PROJECT_ID = 'proj-1';

function notFoundError() {
  const err = new Error('Project not found');
  err.status = 404;
  return err;
}

// Fixtures include all fields returned by getProjectForAccessCheck (KDL-635).
// is_shared and members must be present — the middleware accesses both.
const ownedProject   = { id: PROJECT_ID, created_by: CALLER_ID, is_shared: false, members: [] };
const foreignProject = { id: PROJECT_ID, created_by: OTHER_ID,  is_shared: false, members: [] };
// Org-shared project (e.g. seeded Default Project) — is_shared flag replaces null created_by.
const sharedProject  = { id: PROJECT_ID, created_by: null,      is_shared: true,  members: [] };
// Project where CALLER_ID is a non-owner explicit member.
const memberProject  = {
  id: PROJECT_ID,
  created_by: OTHER_ID,
  is_shared: false,
  members: [{ user_id: CALLER_ID, role: 'member' }],
};

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

    await requireProject()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 2. Non-member, non-owner → 403 (core security check) ────────────────────

  it('returns 403 when caller is neither owner nor member of the project', async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 3. Project owner → passes through ───────────────────────────────────────

  it('calls next and sets req.projectId for project owner', async () => {
    getProjectForAccessCheck.mockResolvedValue(ownedProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── 4. Super-admin bypass → passes through regardless of creator/members ────

  it('calls next for super-admin user even when not owner or member', async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject);
    resolvePermissions.mockResolvedValue({ bypass: true, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
  });

  // ── 5. Missing header → 400 ──────────────────────────────────────────────────

  it('returns 400 when X-Project-Id header is absent', async () => {
    const req = makeReq({ userId: CALLER_ID }); // no projectIdHeader key
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getProjectForAccessCheck).not.toHaveBeenCalled();
  });

  // ── 6. Mutation route — 403 on unauthorised caller ───────────────────────────
  // The mutation path (advanceStage, retryStage, etc.) is the actual security hole
  // described in KDL-606/KDL-627. Simulates POST /runs/:runId/stages/:stage/advance.

  it('blocks an unauthorised mutation caller with 403', async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject); // owned by OTHER_ID, no members
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: ['template-engine:run'] });

    const req = {
      headers: { 'x-project-id': PROJECT_ID },
      user: { id: CALLER_ID },   // caller is not owner or member
      userPermissions: null,
      validated: {
        params: { runId: 'run-1', stage: 'intake' },
        body: {},
        query: {},
      },
    };
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 7. is_shared=true → passes through for any authenticated user ─────────────
  // The seeded Default Project is org-shared via is_shared=true (KDL-635 replaces
  // the old null-created_by convention with this explicit column).

  it('calls next for any authenticated user on an org-shared project (is_shared=true)', async () => {
    getProjectForAccessCheck.mockResolvedValue(sharedProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── 8. requireProject('body') — reads projectId from request body ────────────
  // Covers POST /runs (createRun) where projectId comes from the request body.

  it("reads projectId from req.validated.body when source is 'body'", async () => {
    getProjectForAccessCheck.mockResolvedValue(ownedProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ userId: CALLER_ID, body: { projectId: PROJECT_ID } });
    const res = makeRes();

    await requireProject('body')(req, res, next);

    expect(getProjectForAccessCheck).toHaveBeenCalledWith(PROJECT_ID);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
  });

  it("returns 400 for 'body' source when projectId is absent from body", async () => {
    const req = makeReq({ userId: CALLER_ID }); // body is {}
    const res = makeRes();

    await requireProject('body')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
    expect(getProjectForAccessCheck).not.toHaveBeenCalled();
  });

  // ── 9. requireProject('query') — reads projectId from query string ───────────
  // Covers GET /runs (listRuns) where projectId comes from ?projectId=...

  it("reads projectId from req.validated.query when source is 'query'", async () => {
    getProjectForAccessCheck.mockResolvedValue(ownedProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ userId: CALLER_ID, query: { projectId: PROJECT_ID } });
    const res = makeRes();

    await requireProject('query')(req, res, next);

    expect(getProjectForAccessCheck).toHaveBeenCalledWith(PROJECT_ID);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
  });

  it("returns 403 for 'query' source when caller is not owner or member", async () => {
    getProjectForAccessCheck.mockResolvedValue(foreignProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ userId: CALLER_ID, query: { projectId: PROJECT_ID } });
    const res = makeRes();

    await requireProject('query')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  // ── 10. Explicit project member → passes through (KDL-635) ──────────────────
  // A user who is not the owner but has an explicit project_members row must be
  // allowed. This is the functional gap fixed by KDL-635.

  it('calls next for an explicit project member (non-owner)', async () => {
    getProjectForAccessCheck.mockResolvedValue(memberProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: [] });

    const req = makeReq({ projectIdHeader: PROJECT_ID, userId: CALLER_ID });
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
    expect(res.status).not.toHaveBeenCalled();
  });

  // ── 11. Member on mutation route → passes through (KDL-635) ─────────────────
  // Verifies that membership gates mutations too, not only reads.
  // Simulates POST /runs/:runId/stages/:stage/advance by a project member.

  it('allows a project member on a mutation route (advanceStage)', async () => {
    getProjectForAccessCheck.mockResolvedValue(memberProject);
    resolvePermissions.mockResolvedValue({ bypass: false, permissions: ['template-engine:run'] });

    const req = {
      headers: { 'x-project-id': PROJECT_ID },
      user: { id: CALLER_ID },  // CALLER_ID is in memberProject.members
      userPermissions: null,
      validated: {
        params: { runId: 'run-1', stage: 'intake' },
        body: {},
        query: {},
      },
    };
    const res = makeRes();

    await requireProject()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.projectId).toBe(PROJECT_ID);
    expect(res.status).not.toHaveBeenCalled();
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

    await requireProject()(req, res, next);

    expect(resolvePermissions).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
