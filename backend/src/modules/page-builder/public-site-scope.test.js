import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  templateEngineStage: { findMany: vi.fn() },
  builderPage: { findFirst: vi.fn() },
}));
vi.mock('../../config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));

const { getPublishedBySiteKey } = await import('./service.js');

const where = (call) => prismaMock.builderPage.findFirst.mock.calls[call][0].where;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.templateEngineStage.findMany.mockResolvedValue([{ outputRef: { pageKeyToId: { about: 'pg1' } } }]);
  prismaMock.builderPage.findFirst.mockResolvedValue({ slug: 'about' });
});

describe('getPublishedBySiteKey site scoping (T5.2)', () => {
  it('default site: its own pages plus pages with no site yet', async () => {
    await getPublishedBySiteKey('p1', 'about', { siteId: 's1', isDefault: true });
    expect(where(0)).toMatchObject({ id: 'pg1', OR: [{ site_id: 's1' }, { site_id: null }] });
  });

  it('a non-default site: only pages assigned to it (never siteless ones)', async () => {
    await getPublishedBySiteKey('p1', 'about', { siteId: 's2', isDefault: false });
    expect(where(0).OR).toEqual([{ site_id: 's2' }]);
  });

  it('the slug fallback is scoped the same way', async () => {
    prismaMock.templateEngineStage.findMany.mockResolvedValue([]);
    await getPublishedBySiteKey('p1', 'faq', { siteId: 's2', isDefault: false });
    expect(where(0)).toMatchObject({ slug: 'faq', project_id: 'p1', OR: [{ site_id: 's2' }] });
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
});

describe('landing site root (T5.3)', () => {
  it('"/" on a non-default site falls back to that site\'s first published page', async () => {
    prismaMock.templateEngineStage.findMany.mockResolvedValue([]);
    prismaMock.builderPage.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ slug: 'spring' });
    const page = await getPublishedBySiteKey('p1', 'home', { siteId: 's2', isDefault: false });
    expect(page).toEqual({ slug: 'spring' });
    expect(where(1)).toEqual({ site_id: 's2', status: 'PUBLISHED', deleted_at: null });
  });

  it('does not apply to the default site or to other keys', async () => {
    prismaMock.templateEngineStage.findMany.mockResolvedValue([]);
    prismaMock.builderPage.findFirst.mockResolvedValue(null);
    await getPublishedBySiteKey('p1', 'home', { siteId: 's1', isDefault: true });
    await getPublishedBySiteKey('p1', 'about', { siteId: 's2', isDefault: false });
    expect(prismaMock.builderPage.findFirst).toHaveBeenCalledTimes(2);
  });
});
