/**
 * T04: page routes are checked against the page's own project. Before this, any user with page-builder
 * permissions could read, edit, publish or delete a page of ANY project by id, and create pages in
 * another project through the request body.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({
  prisma: { builderPage: { findFirst: vi.fn() }, project: { findFirst: vi.fn() } },
}));
const access = vi.hoisted(() => ({ getProjectForAccessCheck: vi.fn() }));
vi.mock('../../config/database.js', () => db);
vi.mock('../projects/service.js', () => access);
vi.mock('../user-management/shared/permission-resolver.js', () => ({
  resolvePermissions: vi.fn().mockResolvedValue({ bypass: false, permissions: [] }),
}));
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, _res, next) => ((req.user = { id: req.get('x-user') ?? 'outsider' }), next()),
}));
vi.mock('../../middleware/permission.js', () => ({ requirePermission: () => (_req, _res, next) => next() }));
vi.mock('../../shared/utils/logger.js', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
// Handlers echo the project the middleware resolved, so a test can see which project a call was scoped to.
vi.mock('./controller.js', () => {
  const echo = (req, res) => res.json({ ok: true, projectId: req.projectId });
  return Object.fromEntries(
    [
      'getAll', 'getOne', 'getPublic', 'getPublicSitePage', 'getPublicSitemap', 'getPublicPreview',
      'postPreviewLink', 'getSeoDefaultsHandler', 'putSeoDefaultsHandler', 'postCreate', 'postPublish',
      'postUnpublish', 'postRestore', 'getVersions', 'postPageChecks', 'putUpdate', 'remove',
    ].map((n) => [n, echo])
  );
});

import routes from './routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const app = express();
app.use(express.json());
app.use('/pb', routes);
app.use(errorHandler);

const PRIVATE = { id: 'p1', created_by: 'owner', is_shared: false, members: [{ user_id: 'member', role: 'EDITOR' }] };

beforeEach(() => {
  vi.clearAllMocks();
  access.getProjectForAccessCheck.mockResolvedValue(PRIVATE);
  db.prisma.project.findFirst.mockResolvedValue({ id: 'default-id' });
  db.prisma.builderPage.findFirst.mockResolvedValue({ project_id: 'p1' }); // every page belongs to p1
});

describe('list and create use the request project', () => {
  it('denies an outsider on a private project (403)', async () => {
    const list = await request(app).get('/pb').set('x-project-id', 'p1');
    expect(list.status).toBe(403);
    const create = await request(app).post('/pb').set('x-project-id', 'p1').send({});
    expect(create.status).toBe(403);
  });

  it('lets a member in, scoped to that project', async () => {
    const res = await request(app).get('/pb').set('x-project-id', 'p1').set('x-user', 'member');
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p1');
  });

  it('ignores a project_id in the body: the project is the request project', async () => {
    const res = await request(app)
      .post('/pb')
      .set('x-project-id', 'p1')
      .set('x-user', 'owner')
      .send({ project_id: 'someone-elses' });
    expect(res.status).toBe(200);
    expect(res.body.projectId).toBe('p1');
  });
});

describe('routes addressed by page id check the page project', () => {
  const calls = [
    ['get', '/pb/pg1'],
    ['put', '/pb/pg1'],
    ['post', '/pb/pg1/publish'],
    ['post', '/pb/pg1/unpublish'],
    ['post', '/pb/pg1/preview-link'],
    ['post', '/pb/pg1/checks'],
    ['get', '/pb/pg1/versions'],
    ['post', '/pb/pg1/versions/v1/restore'],
    ['delete', '/pb/pg1'],
  ];

  it.each(calls)('%s %s is 403 for an outsider', async (method, url) => {
    const res = await request(app)[method](url).send({});
    expect(res.status).toBe(403);
  });

  it.each(calls)('%s %s is allowed for a member', async (method, url) => {
    const res = await request(app)[method](url).set('x-user', 'member').send({});
    expect(res.status).toBe(200);
  });

  it('is 404 for a page that does not exist', async () => {
    db.prisma.builderPage.findFirst.mockResolvedValue(null);
    const res = await request(app).get('/pb/missing').set('x-user', 'member');
    expect(res.status).toBe(404);
  });
});
