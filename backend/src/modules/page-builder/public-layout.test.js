import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const m = vi.hoisted(() => ({
  getPublishedBySlug: vi.fn(),
  getPublishedBySiteKey: vi.fn(),
  getSiteLayout: vi.fn(),
  resolvePublicSite: vi.fn(),
  getPublicSiteIdentity: vi.fn(async () => null),
  getPublicSeo: vi.fn(async () => ({ seo: null, seoDefaults: null })),
  listSitemapEntries: vi.fn(),
  updatePage: vi.fn(),
  createPage: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  restore: vi.fn(),
  listVersions: vi.fn(),
  checkPage: vi.fn(),
}));
const previewMock = vi.hoisted(() => ({
  createPreviewLink: vi.fn(),
  getPreviewPage: vi.fn(),
  previewLinkSchema: { safeParse: (b) => (b.ttl_hours > 168 ? { success: false, error: { flatten: () => ({}) } } : { success: true, data: { ttl_hours: b.ttl_hours ?? 24 } }) },
}));
vi.mock('./preview.js', () => previewMock);
vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));
// Link rewriting has its own tests (shared/page-routes.test.js, public-links.test.js); here pages pass through unchanged.
vi.mock('../../shared/page-routes-db.js', () => ({ friendlyLinksFor: vi.fn(async (_project, value) => value) }));
vi.mock('./service.js', () => m);
vi.mock('./schema.js', async () => {
  const { z } = await import('zod');
  return {
    createPageSchema: z.object({ title: z.string().min(1) }),
    updatePageSchema: z.object({ title: z.string().min(1).optional(), status: z.string().optional() }).strict(),
    publishPageSchema: z.object({ title: z.string().min(1).optional(), force: z.boolean().optional() }).strict(),
  };
});
vi.mock('../projects/layout.js', () => ({ getSiteLayout: m.getSiteLayout }));
vi.mock('../projects/sites.js', () => ({ resolvePublicSite: m.resolvePublicSite }));
vi.mock('../projects/site-identity.js', () => ({ getPublicSiteIdentity: m.getPublicSiteIdentity }));
vi.mock('./seo.js', () => ({ getPublicSeo: m.getPublicSeo, getSeoDefaults: vi.fn(), saveSeoDefaults: vi.fn() }));

import {
  getPublic,
  getPublicSitePage,
  getPublicSitemap,
  postCreate,
  putUpdate,
  postPublish,
  postUnpublish,
  postRestore,
  getVersions,
  postPageChecks,
  getPublicPreview,
  postPreviewLink,
} from './controller.js';

const app = express();
app.post('/', express.json(), postCreate);
app.put('/:id', express.json(), putUpdate);
app.post('/:id/publish', express.json(), postPublish);
app.post('/:id/unpublish', postUnpublish);
app.get('/:id/versions', getVersions);
app.post('/:id/checks', express.json(), postPageChecks);
app.post('/:id/versions/:versionId/restore', postRestore);
app.get('/public/sitemap', getPublicSitemap);
app.get('/public/preview/:token', getPublicPreview);
app.post('/:id/preview-link', express.json(), postPreviewLink); // before /public/:slug, as in routes.js
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

describe('public pages carry the site identity overrides (T5.5)', () => {
  it('attaches the overrides of the page site and never leaks site_id', async () => {
    m.getPublishedBySlug.mockResolvedValue({ slug: 'a', title: 'A', data: {}, project_id: 'p1', site_id: 's9' });
    m.getSiteLayout.mockResolvedValue(null);
    m.getPublicSiteIdentity.mockResolvedValue({ app_name: 'Spring' });
    const res = await request(app).get('/public/a');
    expect(res.body.data.page.identity).toEqual({ app_name: 'Spring' });
    expect(res.body.data.page).not.toHaveProperty('site_id');
    expect(m.getPublicSiteIdentity).toHaveBeenCalledWith('s9');
  });
});

describe('public pages carry SEO (T6.1)', () => {
  it('attaches the page seo and site defaults; the raw column is replaced by the resolved one', async () => {
    m.getPublishedBySlug.mockResolvedValue({ slug: 'a', title: 'A', data: {}, seo: { og_image: 'media/x.png' }, project_id: 'p1' });
    m.getSiteLayout.mockResolvedValue(null);
    m.getPublicSeo.mockResolvedValue({ seo: { og_image: 'https://signed/x.png' }, seoDefaults: { title_template: '%s | Co', og_image: '' } });
    const res = await request(app).get('/public/a');
    expect(m.getPublicSeo).toHaveBeenCalledWith({ og_image: 'media/x.png' });
    expect(res.body.data.page.seo).toEqual({ og_image: 'https://signed/x.png' });
    expect(res.body.data.page.seoDefaults).toEqual({ title_template: '%s | Co', og_image: '' });
  });
});

describe('GET /public/sitemap (T6.1)', () => {
  it('lists the entries of the resolved site', async () => {
    m.listSitemapEntries.mockResolvedValue([{ path: '/', lastmod: '2026-01-01T00:00:00.000Z' }]);
    const res = await request(app).get('/public/sitemap?host=shop.example.com');
    expect(res.body.data.entries).toHaveLength(1);
    expect(m.resolvePublicSite.mock.calls[0][1].host).toBe('shop.example.com');
    expect(m.listSitemapEntries).toHaveBeenCalledWith('p1', SITE);
  });
  it('404 when no site matches', async () => {
    m.resolvePublicSite.mockResolvedValue(null);
    expect((await request(app).get('/public/sitemap')).status).toBe(404);
  });
});

describe('admin page writes validate input (T6.1)', () => {
  it('invalid body is a 422 with the field errors, not a 500, and nothing is written', async () => {
    const put = await request(app).put('/p1').send({ title: '' });
    expect(put.status).toBe(422);
    expect(put.body.errors.fieldErrors.title).toBeTruthy();
    expect((await request(app).put('/p1').send({ nope: 1 })).status).toBe(422);
    expect((await request(app).post('/').send({})).status).toBe(422);
    expect(m.updatePage).not.toHaveBeenCalled();
    expect(m.createPage).not.toHaveBeenCalled();
  });
  it('a valid body reaches the service', async () => {
    m.updatePage.mockResolvedValue({ id: 'p1' });
    const res = await request(app).put('/p1').send({ title: 'New' });
    expect(res.status).toBe(200);
    expect(m.updatePage).toHaveBeenCalledWith('p1', { title: 'New' }, undefined);
  });
});

describe('publish workflow endpoints (T6.2)', () => {
  it('publish: validates the body (422), then returns the page', async () => {
    expect((await request(app).post('/p1/publish').send({ title: '' })).status).toBe(422);
    expect(m.publish).not.toHaveBeenCalled();
    m.publish.mockResolvedValue({ id: 'p1', live_version: 2 });
    const res = await request(app).post('/p1/publish').send({ title: 'T' });
    expect(res.body.data.page.live_version).toBe(2);
    expect(m.publish).toHaveBeenCalledWith('p1', { title: 'T' }, undefined);
  });
  it('service errors keep their HTTP status (404 / 409), others become 500', async () => {
    m.unpublish.mockRejectedValue(Object.assign(new Error('Page not found'), { status: 404 }));
    expect((await request(app).post('/x/unpublish')).status).toBe(404);
    m.restore.mockRejectedValue(Object.assign(new Error('Template pages have no versions'), { status: 409 }));
    expect((await request(app).post('/p1/versions/v1/restore')).status).toBe(409);
    m.listVersions.mockRejectedValue(new Error('db down'));
    expect((await request(app).get('/p1/versions')).status).toBe(500);
  });
  it('versions: lists them; restore returns the page', async () => {
    m.listVersions.mockResolvedValue([{ version: 2, is_live: true }]);
    expect((await request(app).get('/p1/versions')).body.data.versions).toHaveLength(1);
    m.restore.mockResolvedValue({ id: 'p1', live_version: 3 });
    const res = await request(app).post('/p1/versions/v1/restore');
    expect(res.body.data.page.live_version).toBe(3);
    expect(m.restore).toHaveBeenCalledWith('p1', 'v1', undefined);
  });
});

describe('signed preview links (T6.3)', () => {
  it('create: returns the link, validates ttl, keeps 404 status', async () => {
    previewMock.createPreviewLink.mockResolvedValue({ token: 't', expires_at: 'x' });
    const ok = await request(app).post('/p1/preview-link').send({ ttl_hours: 2 });
    expect(ok.body.data).toEqual({ token: 't', expires_at: 'x' });
    expect(previewMock.createPreviewLink).toHaveBeenCalledWith('p1', 2);
    expect((await request(app).post('/p1/preview-link').send({ ttl_hours: 999 })).status).toBe(422);
    previewMock.createPreviewLink.mockRejectedValue(Object.assign(new Error('Page not found'), { status: 404 }));
    expect((await request(app).post('/nope/preview-link').send({})).status).toBe(404);
  });

  it('public preview: layout + identity + seo ride along, never cached, never indexed', async () => {
    previewMock.getPreviewPage.mockResolvedValue({ slug: 'a', title: 'A', data: {}, project_id: 'p1', site_id: 's1', seo: null });
    m.getSiteLayout.mockResolvedValue(LAYOUT);
    const res = await request(app).get('/public/preview/tok');
    expect(res.status).toBe(200);
    expect(res.body.data.page.layout).toEqual(LAYOUT);
    expect(res.body.data.page).not.toHaveProperty('site_id');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(previewMock.getPreviewPage).toHaveBeenCalledWith('tok');
  });

  it('public preview: an invalid token is a 404 (still no-store)', async () => {
    previewMock.getPreviewPage.mockRejectedValue(Object.assign(new Error('Page not found'), { status: 404 }));
    const res = await request(app).get('/public/preview/bad');
    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('pre-publish checks endpoints (T6.4)', () => {
  it('publish: a failed check is a 422 whose body carries the code and the issues', async () => {
    const issues = [{ severity: 'error', code: 'LINK_BROKEN', message: 'x' }];
    m.publish.mockRejectedValue(
      Object.assign(new Error('This page has problems to fix before publishing.'), {
        status: 422,
        errors: { code: 'PUBLISH_VALIDATION_FAILED', issues },
      })
    );
    const res = await request(app).post('/p1/publish').send({});
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual({ code: 'PUBLISH_VALIDATION_FAILED', issues });
  });

  it('checks: returns the report; 404 keeps its status', async () => {
    m.checkPage = m.checkPage ?? vi.fn();
    m.checkPage.mockResolvedValue({ issues: [], errors: 0, warnings: 0, can_publish: true });
    const ok = await request(app).post('/p1/checks').send({ title: 'T' });
    expect(ok.body.data.can_publish).toBe(true);
    expect(m.checkPage).toHaveBeenCalledWith('p1', { title: 'T' }); // checks the content the editor sends
    m.checkPage.mockRejectedValue(Object.assign(new Error('Page not found'), { status: 404 }));
    expect((await request(app).post('/x/checks').send({})).status).toBe(404);
    expect((await request(app).post('/p1/checks').send({ title: '' })).status).toBe(422);
  });
});
