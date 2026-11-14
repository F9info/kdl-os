import { describe, it, expect, vi } from 'vitest';

const menuFindFirst = vi.fn();
const pageFindMany = vi.fn();
vi.mock('../../config/database.js', () => ({
  prisma: {
    menu: { findFirst: (a) => menuFindFirst(a) },
    builderPage: { findMany: (a) => pageFindMany(a) },
    detailPageEntry: { findMany: async () => [] },
    templateEngineStage: { findMany: async () => [] },
  },
}));
vi.mock('../template-engine/site/queue.js', () => ({ enqueueSiteBuild: vi.fn() }));
vi.mock('./scaffold-page.js', () => ({ scaffoldPageForLabel: vi.fn() }));
vi.mock('../template-engine/site/unregister-page.js', () => ({ renameInWebsiteStage: vi.fn(), unregisterFromWebsiteStage: vi.fn() }));
vi.mock('../page-builder/service.js', () => ({ deletePage: vi.fn() }));
vi.mock('../detail-page-types/entries.service.js', () => ({ createType: vi.fn(), deleteType: vi.fn() }));
vi.mock('./site-menus.js', () => ({ getFooterSameAsHeader: async () => false, setFooterSameAsHeader: vi.fn() }));

const { getPublicMenu } = await import('./service.js');

const item = (id, o = {}) => ({ id, label: id, is_active: true, order: 0, parent_id: null, page_id: null, url: null, no_page: false, ...o });

describe('public menu hides links to pages that are not live', () => {
  it('drops unpublished/deleted page links and their children; keeps live pages, headings and external links', async () => {
    menuFindFirst.mockResolvedValue({
      id: 'm', project_id: 'p1', key: 'header',
      items: [
        item('live', { page_id: 'a', url: '/p/a' }),
        item('draft', { page_id: 'b', url: '/p/b' }),
        item('child-of-draft', { parent_id: 'draft', page_id: 'a', url: '/p/a' }),
        item('gone-by-slug', { url: '/p/old' }),
        item('heading', { no_page: true }),
        item('external', { url: 'https://example.com' }),
      ],
    });
    pageFindMany.mockResolvedValue([
      { id: 'a', slug: 'a', status: 'PUBLISHED', deleted_at: null, template_id: null },
      { id: 'b', slug: 'b', status: 'DRAFT', deleted_at: null, template_id: null },
      { id: 'c', slug: 'old', status: 'PUBLISHED', deleted_at: new Date(), template_id: null },
    ]);
    const menu = await getPublicMenu('p1', 'header');
    expect(menu.items.map((i) => i.id).sort()).toEqual(['external', 'heading', 'live']);
  });

  it('does not touch a menu whose pages are all live', async () => {
    menuFindFirst.mockResolvedValue({ id: 'm', project_id: 'p1', key: 'header', items: [item('x', { page_id: 'a', url: '/p/a' })] });
    pageFindMany.mockResolvedValue([{ id: 'a', slug: 'a', status: 'PUBLISHED', deleted_at: null, template_id: null }]);
    const menu = await getPublicMenu('p1', 'header');
    expect(menu.items.map((i) => i.id)).toEqual(['x']);
  });
});
