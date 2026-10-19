/**
 * Route wiring for per-project values: `projectId` on admin by-type / values must pass
 * through requireProject (404 unknown project, 403 no access) and reach the service;
 * without it the global path is unchanged. Public values takes `project_id`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const svc = vi.hoisted(() => ({
  getTypeBySlug: vi.fn(),
  getFieldsForType: vi.fn(),
  typeExists: vi.fn(),
  saveValues: vi.fn(),
  getValuesBySlugs: vi.fn(),
  getValueBySlug: vi.fn(),
}));
const projectSvc = vi.hoisted(() => ({ getProjectForAccessCheck: vi.fn() }));

vi.mock('./service.js', () => svc);
vi.mock('../projects/service.js', () => projectSvc);
vi.mock('../user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ bypass: false, permissions: [] }),
}));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => ((req.user = { id: 'u1' }), next()),
}));
vi.mock('../../middleware/permission.js', () => ({ requirePermission: () => (_q, _r, n) => n() }));
vi.mock('../../middleware/upload.js', () => ({ upload: { single: () => (_q, _r, n) => n() } }));
vi.mock('../../shared/services/storage.service.js', () => ({}));
vi.mock('../template-engine/site/queue.js', () => ({
  enqueueAllSiteBuilds: vi.fn(),
  enqueueSiteBuild: vi.fn(),
}));

import router from './routes.js';

const app = express();
app.use(express.json());
app.use('/sf', router);

const SHARED = { id: 'p1', is_shared: true, created_by: null, members: [] };

beforeEach(() => {
  vi.clearAllMocks();
  svc.getTypeBySlug.mockResolvedValue({ id: 't1', slug: 'website-content' });
  svc.getFieldsForType.mockResolvedValue([]);
  svc.typeExists.mockResolvedValue({ id: 't1' });
  svc.saveValues.mockResolvedValue(1);
  svc.getValuesBySlugs.mockResolvedValue({});
  projectSvc.getProjectForAccessCheck.mockResolvedValue(SHARED);
});

describe('admin by-type', () => {
  it('without projectId: global fields, no project check', async () => {
    await request(app).get('/sf/by-type/website-content').expect(200);
    expect(projectSvc.getProjectForAccessCheck).not.toHaveBeenCalled();
    expect(svc.getFieldsForType).toHaveBeenCalledWith('t1', null);
  });

  it('with projectId: checks access and passes the project to the service', async () => {
    await request(app).get('/sf/by-type/website-content?projectId=p1').expect(200);
    expect(projectSvc.getProjectForAccessCheck).toHaveBeenCalledWith('p1');
    expect(svc.getFieldsForType).toHaveBeenCalledWith('t1', 'p1');
  });

  it('unknown project -> 404 and the service is never reached', async () => {
    projectSvc.getProjectForAccessCheck.mockRejectedValue(Object.assign(new Error('x'), { status: 404 }));
    await request(app).get('/sf/by-type/website-content?projectId=nope').expect(404);
    expect(svc.getFieldsForType).not.toHaveBeenCalled();
  });

  it('a project the caller cannot access -> 403', async () => {
    projectSvc.getProjectForAccessCheck.mockResolvedValue({ id: 'p2', is_shared: false, created_by: 'someone-else', members: [] });
    await request(app).get('/sf/by-type/website-content?projectId=p2').expect(403);
    expect(svc.getFieldsForType).not.toHaveBeenCalled();
  });
});

describe('admin save values', () => {
  const body = { type_id: 't1', values: [{ id: 'f1', value: 'x' }] };

  it('global save when no projectId', async () => {
    await request(app).post('/sf/values').send(body).expect(200);
    expect(svc.saveValues).toHaveBeenCalledWith('t1', body.values, { projectId: null, userId: 'u1' });
  });

  it('project save when projectId is given', async () => {
    await request(app).post('/sf/values').send({ ...body, projectId: 'p1' }).expect(200);
    expect(svc.saveValues).toHaveBeenCalledWith('t1', body.values, { projectId: 'p1', userId: 'u1' });
  });

  it('inaccessible project is rejected before anything is written', async () => {
    projectSvc.getProjectForAccessCheck.mockResolvedValue({ id: 'p2', is_shared: false, created_by: 'other', members: [] });
    await request(app).post('/sf/values').send({ ...body, projectId: 'p2' }).expect(403);
    expect(svc.saveValues).not.toHaveBeenCalled();
  });
});

describe('public values', () => {
  it('forwards project_id', async () => {
    await request(app).get('/sf/public/values?slugs=a,b&project_id=p1').expect(200);
    expect(svc.getValuesBySlugs).toHaveBeenCalledWith(['a', 'b'], 'p1');
  });
  it('works without project_id (global)', async () => {
    await request(app).get('/sf/public/values?slugs=a').expect(200);
    expect(svc.getValuesBySlugs).toHaveBeenCalledWith(['a'], null);
  });
});
