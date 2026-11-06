import { describe, it, expect, vi, beforeEach } from 'vitest';

const getPublicEntry = vi.fn();
const getSiteLayout = vi.fn();
vi.mock('./entries.service.js', () => ({ getPublicEntry }));
vi.mock('../projects/layout.js', () => ({ getSiteLayout }));
vi.mock('./service.js', () => ({ getDetailPageTypesForProject: vi.fn() }));
vi.mock('../menus/service.js', () => ({ addDetailTypeToHeaderMenu: vi.fn() }));
vi.mock('../../shared/default-project.js', () => ({ getDefaultProjectId: vi.fn(async () => 'p1') }));
vi.mock('../../config/database.js', () => ({ prisma: {} }));

const { getPublic } = await import('./controller.js');

const run = async () => {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
  await getPublic({ query: {}, params: { prefix: 'service', slug: 'page1' } }, res, vi.fn());
  return res.json.mock.calls[0][0];
};

describe('GET /detail-page-types/public/:prefix/:slug', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the saved site layout with the page so the header matches the rest of the site', async () => {
    getPublicEntry.mockResolvedValue({ entry: { id: 'e' }, page: { data: {}, title: 'T' } });
    getSiteLayout.mockResolvedValue({ header: { design: 'ConstructionHeader' } });
    const body = await run();
    expect(getSiteLayout).toHaveBeenCalledWith('p1');
    expect(body.data.page.layout).toEqual({ header: { design: 'ConstructionHeader' } });
  });

  it('skips the layout lookup for an entry without a page', async () => {
    getPublicEntry.mockResolvedValue({ entry: { id: 'e' }, page: null });
    const body = await run();
    expect(getSiteLayout).not.toHaveBeenCalled();
    expect(body.data.page).toBeNull();
  });
});
