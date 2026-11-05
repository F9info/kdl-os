import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const m = vi.hoisted(() => ({
  getPublishedBySlug: vi.fn(),
  getPublishedBySiteKey: vi.fn(),
  getSiteLayout: vi.fn(),
  resolvePublicSite: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));
vi.mock('./service.js', () => m);
vi.mock('../projects/layout.js', () => ({ getSiteLayout: m.getSiteLayout }));
vi.mock('../projects/sites.js', () => ({ resolvePublicSite: m.resolvePublicSite }));

import { getPublic, getPublicSitePage } from './controller.js';

const app = express();
app.get('/public/:slug', getPublic);
app.get('/public/site/:key', getPublicSitePage);
app.use((err, req, res, _next) => res.status(500).json({ success: false, message: err.message }));

const LAYOUT = { header: { enabled: true, variant: '3' } };
const SITE = { projectId: 'p1', siteId: 's1', isDefault: true };
beforeEach(() => {
  vi.clearAllMocks();
  m.resolvePublicSite.mockResolvedValue(SITE);
});

describe('public pages carry the project layout (T4.2)', () => {
  it('by slug: attaches the saved layout of the page project', async () => {
    m.getPublishedBySlug.mockResolvedValue({ slug: 'a', title: 'A', data: {}, project_id: 'p1' });
    m.getSiteLayout.mockResolvedValue(LAYOUT);
    const res = await request(app).get('/public/a');
    expect(res.status).toBe(200);
    expect(res.body.data.page).toMatchObject({ slug: 'a', layout: LAYOUT });
    expect(m.getSiteLayout).toHaveBeenCalledWith('p1');
  });

  it('by site key: attaches it too', async () => {
    m.getPublishedBySiteKey.mockResolvedValue({ slug: 'home', title: 'Home', data: {}, project_id: 'p1' });
    m.getSiteLayout.mockResolvedValue(LAYOUT);
    const res = await request(app).get('/public/site/home');
    expect(res.body.data.page.layout).toEqual(LAYOUT);
  });

  it('layout is null when the project saved none, or the page has no project', async () => {
    m.getPublishedBySlug.mockResolvedValue({ slug: 'a', title: 'A', data: {}, project_id: 'p1' });
    m.getSiteLayout.mockResolvedValue(null);
    expect((await request(app).get('/public/a')).body.data.page.layout).toBeNull();
    m.getPublishedBySlug.mockResolvedValue({ slug: 'b', title: 'B', data: {}, project_id: null });
    const res = await request(app).get('/public/b');
    expect(res.body.data.page.layout).toBeNull();
    expect(m.getSiteLayout).toHaveBeenCalledTimes(1); // not asked for a page without a project
  });

  it('still 404s for a missing page without looking up a layout', async () => {
    m.getPublishedBySlug.mockResolvedValue(null);
    expect((await request(app).get('/public/zzz')).status).toBe(404);
    expect(m.getSiteLayout).not.toHaveBeenCalled();
  });
});

describe('public site routing (T5.2)', () => {
  const page = { slug: 'home', title: 'Home', data: {}, project_id: 'p1' };

  it('resolves the site from the request host and scopes the page lookup to it', async () => {
    m.getPublishedBySiteKey.mockResolvedValue(page);
    m.getSiteLayout.mockResolvedValue(null);
    await request(app).get('/public/site/home').set('Host', 'shop.example.com');
    expect(m.resolvePublicSite.mock.calls[0][1]).toMatchObject({ host: 'shop.example.com', projectId: 'p1' });
    expect(m.getPublishedBySiteKey).toHaveBeenCalledWith('p1', 'home', SITE);
  });

  it('?host= (sent by the Next server) wins over the Host header; X-Forwarded-Host beats Host', async () => {
    m.getPublishedBySiteKey.mockResolvedValue(page);
    await request(app).get('/public/site/home?host=a.test').set('Host', 'b.test');
    expect(m.resolvePublicSite.mock.calls[0][1].host).toBe('a.test');
    await request(app).get('/public/site/home').set('Host', 'b.test').set('X-Forwarded-Host', 'c.test');
    expect(m.resolvePublicSite.mock.calls[1][1].host).toBe('c.test');
  });

  it('passes ?site= and ?project_id= through; ignores non-string values', async () => {
    m.getPublishedBySiteKey.mockResolvedValue(page);
    await request(app).get('/public/site/home?site=launch&project_id=p9');
    expect(m.resolvePublicSite.mock.calls[0][1]).toMatchObject({ siteSlug: 'launch', projectId: 'p9' });
    await request(app).get('/public/site/home?site=a&site=b');
    expect(m.resolvePublicSite.mock.calls[1][1].siteSlug).toBeUndefined();
  });

  it('404s when no site resolves (unknown ?site=) without looking for a page', async () => {
    m.resolvePublicSite.mockResolvedValue(null);
    expect((await request(app).get('/public/site/home?site=nope')).status).toBe(404);
    expect(m.getPublishedBySiteKey).not.toHaveBeenCalled();
  });
});
