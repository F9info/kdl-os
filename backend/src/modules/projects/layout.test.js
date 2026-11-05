import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const prismaMock = vi.hoisted(() => ({
  siteLayout: { findUnique: vi.fn(), upsert: vi.fn() },
  project: { findFirst: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('./onboarding.js', () => ({ getOnboarding: vi.fn(), answerOnboarding: vi.fn() }));
vi.mock('./service.js', () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}));
// x-user header = logged in, x-perm header = has the permission.
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req, res, next) => (req.headers['x-user'] ? ((req.user = { id: 'u1' }), next()) : res.status(401).json({ success: false })),
}));
vi.mock('../../middleware/permission.js', () => ({
  requirePermission: () => (req, res, next) => (req.headers['x-perm'] ? next() : res.status(403).json({ success: false })),
}));

import router from './routes.js';
import { getSiteLayout, saveSiteLayout } from './layout.js';

const app = express();
app.use(express.json());
app.use('/api/projects', router);
app.use((err, req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const slot = (variant = '5', enabled = true) => ({ enabled, variant });
const row = (o = {}) => ({ project_id: 'p1', top_header: {}, header: {}, footer: {}, ...o });
const H = { 'x-user': '1', 'x-perm': '1' };

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.project.findFirst.mockResolvedValue({ id: 'p1' });
  prismaMock.siteLayout.upsert.mockResolvedValue({});
});

describe('getSiteLayout', () => {
  it('returns null when nothing was saved (no row, or only empty slots)', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(null);
    expect(await getSiteLayout('p1')).toBeNull();
    prismaMock.siteLayout.findUnique.mockResolvedValue(row());
    expect(await getSiteLayout('p1')).toBeNull();
  });

  it('maps columns to API slots and omits empty ones', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(row({ top_header: slot('1'), footer: slot('custom:abc', false) }));
    expect(await getSiteLayout('p1')).toEqual({ topHeader: slot('1'), footer: slot('custom:abc', false) });
  });
});

describe('saveSiteLayout', () => {
  it('upserts only the slots sent, leaving the others untouched', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(row({ header: slot('3') }));
    await saveSiteLayout('p1', { header: slot('3') });
    expect(prismaMock.siteLayout.upsert).toHaveBeenCalledWith({
      where: { project_id: 'p1' },
      update: { header: slot('3') },
      create: { project_id: 'p1', header: slot('3') },
    });
  });

  it('404s for an unknown project and writes nothing', async () => {
    prismaMock.project.findFirst.mockResolvedValue(null);
    await expect(saveSiteLayout('nope', { header: slot() })).rejects.toMatchObject({ status: 404 });
    expect(prismaMock.siteLayout.upsert).not.toHaveBeenCalled();
  });
});

describe('/api/projects/:id/layout', () => {
  it('needs login and permission', async () => {
    expect((await request(app).get('/api/projects/p1/layout')).status).toBe(401);
    expect((await request(app).get('/api/projects/p1/layout').set('x-user', '1')).status).toBe(403);
    expect((await request(app).put('/api/projects/p1/layout').set('x-user', '1').send({ header: slot() })).status).toBe(403);
  });

  it('GET returns { layout: null } before anything is saved', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/api/projects/p1/layout').set(H);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ layout: null });
  });

  it('PUT saves and returns the layout', async () => {
    prismaMock.siteLayout.findUnique.mockResolvedValue(row({ header: slot('2') }));
    const res = await request(app).put('/api/projects/p1/layout').set(H).send({ header: slot('2') });
    expect(res.status).toBe(200);
    expect(res.body.data.layout).toEqual({ header: slot('2') });
  });

  it('PUT rejects bad variants, unknown keys and an empty body (422)', async () => {
    for (const body of [{ header: slot('9') }, { header: { enabled: 'yes', variant: '1' } }, { sidebar: slot() }, {}]) {
      const res = await request(app).put('/api/projects/p1/layout').set(H).send(body);
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    expect(prismaMock.siteLayout.upsert).not.toHaveBeenCalled();
  });
});
