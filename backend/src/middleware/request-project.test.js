import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDefaultProjectId: vi.fn(),
  getProjectForAccessCheck: vi.fn(),
  resolvePermissions: vi.fn(),
}));
vi.mock('../shared/default-project.js', () => ({ getDefaultProjectId: mocks.getDefaultProjectId }));
vi.mock('../modules/projects/service.js', () => ({ getProjectForAccessCheck: mocks.getProjectForAccessCheck }));
vi.mock('../modules/user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: mocks.resolvePermissions,
}));

const { requestProject, resolveRequestedProjectId } = await import('./request-project.js');

const run = async (overrides) => {
  const req = { headers: {}, query: {}, user: { id: 'u1' }, ...overrides };
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  const next = vi.fn();
  await requestProject(req, res, next);
  return { req, res, next };
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDefaultProjectId.mockResolvedValue('default-id');
  mocks.resolvePermissions.mockResolvedValue({ bypass: false });
  mocks.getProjectForAccessCheck.mockImplementation(async (id) => ({
    id,
    is_shared: id === 'default-id',
    created_by: id === 'mine' ? 'u1' : 'someone-else',
    members: [],
  }));
});

describe('resolveRequestedProjectId', () => {
  it('prefers the X-Project-Id header, then ?projectId, then ?project_id, then the default', async () => {
    expect(await resolveRequestedProjectId({ headers: { 'x-project-id': 'h' }, query: { projectId: 'q' } })).toBe('h');
    expect(await resolveRequestedProjectId({ headers: {}, query: { projectId: 'q', project_id: 'r' } })).toBe('q');
    expect(await resolveRequestedProjectId({ headers: {}, query: { project_id: 'r' } })).toBe('r');
    expect(await resolveRequestedProjectId({ headers: {}, query: {} })).toBe('default-id');
  });

  it('ignores empty and non-string values', async () => {
    expect(await resolveRequestedProjectId({ headers: { 'x-project-id': '' }, query: { projectId: ['a', 'b'] } })).toBe(
      'default-id'
    );
  });
});

describe('requestProject', () => {
  it('uses the default project when nothing is sent', async () => {
    const { req, next } = await run({});
    expect(next).toHaveBeenCalledWith();
    expect(req.projectId).toBe('default-id');
  });

  it('sets req.projectId for a project the caller owns', async () => {
    const { req, next } = await run({ headers: { 'x-project-id': 'mine' } });
    expect(next).toHaveBeenCalledWith();
    expect(req.projectId).toBe('mine');
  });

  it('refuses a project the caller does not belong to (403), so the header cannot read another project', async () => {
    const { req, res, next } = await run({ headers: { 'x-project-id': 'not-mine' } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
    expect(req.projectId).toBeUndefined();
  });

  it('lets a super-admin use any project', async () => {
    mocks.resolvePermissions.mockResolvedValue({ bypass: true });
    const { next, res } = await run({ headers: { 'x-project-id': 'not-mine' } });
    expect(res.status).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith();
  });

  it('answers 404 for an unknown project', async () => {
    mocks.getProjectForAccessCheck.mockRejectedValue(Object.assign(new Error('Project not found'), { status: 404 }));
    const { res } = await run({ headers: { 'x-project-id': 'gone' } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('answers 404 when no project exists at all', async () => {
    mocks.getDefaultProjectId.mockResolvedValue(null);
    const { res } = await run({});
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
