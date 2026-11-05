import { describe, it, expect, vi } from 'vitest';
import {
  addPageToMenus,
  removePageFromMenus,
  getFooterSameAsHeader,
  setFooterSameAsHeader,
} from './site-menus.js';

const page = { id: 'pg1', slug: 'about', title: 'About' };

function client({ existing = null, last = { order: 2 } } = {}) {
  return {
    menu: { upsert: vi.fn(async ({ create }) => ({ id: `m-${create.key}` })) },
    menuItem: {
      findFirst: vi.fn(async ({ where }) => (where.OR ? existing : last)),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    appSetting: { findUnique: vi.fn(), upsert: vi.fn().mockResolvedValue({}) },
  };
}

describe('addPageToMenus', () => {
  it('appends a page link to header and footer', async () => {
    const c = client();
    const added = await addPageToMenus(c, { projectId: 'p1', page });
    expect(added).toEqual(['header', 'footer']);
    const data = c.menuItem.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      label: 'About',
      link_type: 'page',
      page_id: 'pg1',
      url: '/p/about',
      order: 3,
    });
  });

  it('can skip the header (footer only)', async () => {
    const c = client();
    expect(await addPageToMenus(c, { projectId: 'p1', page, header: false })).toEqual(['footer']);
  });

  it('never adds a page that is already in the menu', async () => {
    const c = client({ existing: { id: 'x' } });
    expect(await addPageToMenus(c, { projectId: 'p1', page })).toEqual([]);
    expect(c.menuItem.create).not.toHaveBeenCalled();
  });
});

describe('removePageFromMenus', () => {
  it('deletes the page links and moves their sub-items up one level', async () => {
    const c = client();
    c.menuItem.findMany.mockResolvedValue([{ id: 'i1', parent_id: 'top' }]);
    expect(await removePageFromMenus(c, page)).toBe(1);
    expect(c.menuItem.updateMany).toHaveBeenCalledWith({
      where: { parent_id: 'i1' },
      data: { parent_id: 'top' },
    });
    expect(c.menuItem.deleteMany).toHaveBeenCalledWith({ where: { id: 'i1' } });
    expect(c.menuItem.findMany.mock.calls[0][0].where.OR).toEqual([
      { page_id: 'pg1' },
      { url: '/p/about' },
    ]);
  });
});

describe('footer same as header option', () => {
  it('is off unless set, and round-trips', async () => {
    const c = client();
    c.appSetting.findUnique.mockResolvedValue(null);
    expect(await getFooterSameAsHeader(c)).toBe(false);
    await setFooterSameAsHeader(c, true);
    expect(c.appSetting.upsert.mock.calls[0][0].update.value).toBe('true');
    c.appSetting.findUnique.mockResolvedValue({ value: 'true' });
    expect(await getFooterSameAsHeader(c)).toBe(true);
  });
});
