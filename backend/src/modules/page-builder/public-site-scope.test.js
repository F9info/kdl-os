import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  builderPage: { findFirst: vi.fn(), findMany: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));

const { getPublishedBySiteKey, listSitemapEntries } = await import('./service.js');

const where = (call) => prismaMock.builderPage.findFirst.mock.calls[call][0].where;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.builderPage.findFirst.mockResolvedValue({ slug: 'about' });
});

describe('getPublishedBySiteKey site scoping (T5.2)', () => {
  it('looks the page up by its route key, only published, in the default site plus pages with no site yet', async () => {
    await getPublishedBySiteKey('p1', 'about', { siteId: 's1', isDefault: true });
    expect(where(0)).toMatchObject({
      project_id: 'p1',
      route_key: 'about',
      status: 'PUBLISHED',
      deleted_at: null,
      template_id: null,
      OR: [{ site_id: 's1' }, { site_id: null }],
    });
  });

  it('a non-default site: only pages assigned to it (never siteless ones)', async () => {
    await getPublishedBySiteKey('p1', 'about', { siteId: 's2', isDefault: false });
    expect(where(0).OR).toEqual([{ site_id: 's2' }]);
  });

  it('the slug fallback is scoped the same way', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValueOnce(null);
    await getPublishedBySiteKey('p1', 'faq', { siteId: 's2', isDefault: false });
    expect(where(1)).toMatchObject({ slug: 'faq', project_id: 'p1', status: 'PUBLISHED', OR: [{ site_id: 's2' }] });
  });

  it('no site (project has none yet) = no site filter, exactly as before sites', async () => {
    await getPublishedBySiteKey('p1', 'about', { siteId: null, isDefault: true });
    expect(where(0)).not.toHaveProperty('OR');
    await getPublishedBySiteKey('p1', 'about');
    expect(where(1)).not.toHaveProperty('OR');
  });

  it('returns null when the page is not in this site', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    expect(await getPublishedBySiteKey('p1', 'about', { siteId: 's2', isDefault: false })).toBeNull();
  });

  it('"home" is just the key "home": no title guessing, an unpublished Home is never served', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    await getPublishedBySiteKey('p1', 'home', { siteId: 's1', isDefault: true });
    expect(where(0)).toMatchObject({ route_key: 'home', status: 'PUBLISHED' });
    expect(prismaMock.builderPage.findFirst).toHaveBeenCalledTimes(2); // key, then slug
    expect(JSON.stringify(prismaMock.builderPage.findFirst.mock.calls)).not.toMatch(/insensitive/);
  });

  it('the oldest published page with the key wins, so old drafts sharing "home" cannot change the answer', async () => {
    await getPublishedBySiteKey('p1', 'home', { siteId: 's1', isDefault: true });
    expect(prismaMock.builderPage.findFirst.mock.calls[0][0].orderBy).toEqual({ created_at: 'asc' });
  });
});

describe('landing site root (T5.3)', () => {
  it('"/" on a non-default site falls back to that site\'s first published page', async () => {
    prismaMock.builderPage.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ slug: 'spring' });
    const page = await getPublishedBySiteKey('p1', 'home', { siteId: 's2', isDefault: false });
    expect(page).toEqual({ slug: 'spring' });
    expect(where(2)).toEqual({ site_id: 's2', status: 'PUBLISHED', deleted_at: null });
  });

  it('does not apply to the default site or to other keys', async () => {
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    await getPublishedBySiteKey('p1', 'home', { siteId: 's1', isDefault: true });
    await getPublishedBySiteKey('p1', 'about', { siteId: 's2', isDefault: false });
    expect(prismaMock.builderPage.findFirst).toHaveBeenCalledTimes(4); // key + slug for each, no third lookup
  });
});

describe('listSitemapEntries (T6.1)', () => {
  const page = (id, slug, title, route_key = null, seo = null) => ({ id, slug, title, route_key, status: 'PUBLISHED', seo, updated_at: new Date('2026-01-01') });

  it('default site: the same routes the site generator serves ("/" for home), noindex dropped', async () => {
    prismaMock.builderPage.findMany.mockResolvedValue([
      page('a', 'demo-home', 'Home', 'home'),
      page('b', 'demo-about', 'About', 'about'),
      page('c', 'demo-secret', 'Secret', 'secret', { noindex: true }),
      page('d', 'orphan', 'Orphan'),
    ]);
    const entries = await listSitemapEntries('p1', { siteId: 's1', isDefault: true });
    expect(entries.map((e) => e.path)).toEqual(['/', '/about', '/orphan']);
    expect(prismaMock.builderPage.findMany.mock.calls[0][0].where).toMatchObject({ status: 'PUBLISHED', template_id: null, OR: [{ site_id: 's1' }, { site_id: null }] });
  });

  it('a page whose key is a platform path is listed at the address it is actually served at', async () => {
    prismaMock.builderPage.findMany.mockResolvedValue([page('a', 'x-admin', 'Admin', 'admin')]);
    expect((await listSitemapEntries('p1', { siteId: 's1', isDefault: true })).map((e) => e.path)).toEqual(['/admin-page']);
  });

  it('landing (non-default) site: /p/<slug>', async () => {
    prismaMock.builderPage.findMany.mockResolvedValue([page('x', 'spring', 'Spring')]);
    const entries = await listSitemapEntries('p1', { siteId: 's2', isDefault: false });
    expect(entries).toEqual([{ path: '/p/spring', lastmod: new Date('2026-01-01') }]);
  });
});
