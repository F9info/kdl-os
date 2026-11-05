import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: {
    customBlockTemplate: { findFirst: vi.fn() },
    builderPage: { findMany: vi.fn(), findFirst: vi.fn() },
    $queryRaw: vi.fn(),
  },
  updatePage: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));
vi.mock('../page-builder/service.js', () => ({ updatePage: h.updatePage }));
vi.mock('../page-builder/versions.js', () => ({ workingData: (p) => p.draft_data ?? p.data }));

const { linkedBlocks, blockState, relinkContent, listInstances, updateInstances } =
  await import('./instances.js');

const CFG_V1 = { category: 'general', atoms: [{ id: 'a', type: 'heading', text: 'Old' }], settings: {} };
const CFG_V2 = { category: 'general', atoms: [{ id: 'a', type: 'heading', text: 'New' }], settings: {} };
const TPL = { id: 't1', project_id: 'p1', version: 3, config: CFG_V2 };
const block = (over = {}) => ({
  type: 'CustomComposedBlock',
  props: { id: 'b', config: CFG_V1, templateId: 't1', templateVersion: 1, ...over },
});
const page = (id, content, over = {}) => ({
  id,
  title: id,
  slug: id,
  status: 'DRAFT',
  data: { content },
  draft_data: null,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  h.prisma.customBlockTemplate.findFirst.mockResolvedValue(TPL);
});

describe('pure helpers', () => {
  it('linkedBlocks: only custom blocks of that section (ignores copies without a link and other sections)', () => {
    const data = {
      content: [
        block(),
        block({ templateId: 'other' }),
        { type: 'CustomComposedBlock', props: { id: 'x', config: CFG_V1 } },
        { type: 'Hero', props: { templateId: 't1' } },
      ],
    };
    expect(linkedBlocks(data, 't1')).toHaveLength(1);
    expect(linkedBlocks({}, 't1')).toEqual([]);
  });

  it('blockState: current, outdated, detached (detached wins)', () => {
    expect(blockState(block({ templateVersion: 3 }), 3)).toBe('current');
    expect(blockState(block({ templateVersion: 1 }), 3)).toBe('outdated');
    expect(blockState(block({ templateVersion: undefined }), 3)).toBe('outdated');
    expect(blockState(block({ templateVersion: 1, templateDetached: true }), 3)).toBe('detached');
  });

  it('relinkContent: updates outdated linked blocks only, keeps ids and other props', () => {
    const detached = block({ id: 'd', templateDetached: true });
    const other = block({ id: 'o', templateId: 'other' });
    const hero = { type: 'Hero', props: { id: 'h' } };
    const { content, changed } = relinkContent([block(), detached, other, hero], TPL);
    expect(changed).toBe(1);
    expect(content[0].props).toMatchObject({ id: 'b', config: CFG_V2, templateVersion: 3, templateId: 't1' });
    expect(content[1]).toBe(detached); // customised on the page: left alone
    expect(content[2]).toBe(other);
    expect(content[3]).toBe(hero);
  });

  it('relinkContent: a block already at the latest version and config is not touched', () => {
    const current = block({ templateVersion: 3, config: CFG_V2 });
    const r = relinkContent([current], TPL);
    expect(r.changed).toBe(0);
    expect(r.content[0]).toBe(current);
  });
});

describe('listInstances', () => {
  it('lists pages using the section with outdated / detached counts, from the working copy', async () => {
    h.prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    h.prisma.builderPage.findMany.mockResolvedValue([
      page('a', [block({ templateVersion: 1 }), block({ id: 'b2', templateVersion: 3 })]),
      // live content is current but the unpublished draft is behind: the draft is what gets updated
      page('b', [block({ templateVersion: 3 })], {
        status: 'PUBLISHED',
        draft_data: { content: [block({ templateVersion: 1 })] },
      }),
      page('c', [block({ templateDetached: true })]),
    ]);
    const r = await listInstances('t1', 'p1');
    expect(r.version).toBe(3);
    expect(r.pages).toEqual([
      expect.objectContaining({ id: 'a', blocks: 2, outdated: 1, detached: 0 }),
      expect.objectContaining({ id: 'b', blocks: 1, outdated: 1 }),
      expect.objectContaining({ id: 'c', blocks: 1, outdated: 0, detached: 1 }),
    ]);
  });

  it('scopes the template lookup to the project; 404 for another project’s or a deleted section', async () => {
    h.prisma.customBlockTemplate.findFirst.mockResolvedValue(null);
    await expect(listInstances('t1', 'other')).rejects.toMatchObject({ status: 404 });
    expect(h.prisma.customBlockTemplate.findFirst.mock.calls[0][0].where).toEqual({
      id: 't1',
      project_id: 'other',
      deleted_at: null,
    });
  });

  it('no page uses it: empty list, no page query', async () => {
    h.prisma.$queryRaw.mockResolvedValue([]);
    expect(await listInstances('t1', 'p1')).toEqual({ version: 3, pages: [] });
    expect(h.prisma.builderPage.findMany).not.toHaveBeenCalled();
  });
});

describe('updateInstances', () => {
  beforeEach(() => {
    h.prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    const pages = { a: page('a', [block()]), b: page('b', [block({ id: 'b2' })], { status: 'PUBLISHED' }) };
    h.prisma.builderPage.findMany.mockResolvedValue(Object.values(pages));
    h.prisma.builderPage.findFirst.mockImplementation(async ({ where }) => pages[where.id]);
  });

  it('saves the new config through updatePage (so a published page only gets a draft change) and reports what needs publishing', async () => {
    const r = await updateInstances('t1', 'p1', undefined, 'u1');
    expect(h.updatePage).toHaveBeenCalledTimes(2);
    const [id, patch, actor] = h.updatePage.mock.calls[0];
    expect(id).toBe('a');
    expect(actor).toBe('u1');
    expect(patch.data.content[0].props).toMatchObject({ config: CFG_V2, templateVersion: 3 });
    expect(r).toMatchObject({ version: 3, needsPublish: 1 });
    expect(r.updated.map((p) => p.id)).toEqual(['a', 'b']);
    expect(patch).not.toHaveProperty('status'); // never publishes by itself
  });

  it('page_ids limits it to those pages', async () => {
    const r = await updateInstances('t1', 'p1', ['b'], 'u1');
    expect(r.updated.map((p) => p.id)).toEqual(['b']);
    expect(h.updatePage).toHaveBeenCalledTimes(1);
  });

  it('pages with nothing behind are skipped', async () => {
    h.prisma.builderPage.findFirst.mockResolvedValue(
      page('a', [block({ templateVersion: 3, config: CFG_V2 })])
    );
    h.prisma.$queryRaw.mockResolvedValue([{ id: 'a' }]);
    h.prisma.builderPage.findMany.mockResolvedValue([
      page('a', [block({ templateVersion: 3, config: CFG_V2 })]),
    ]);
    expect((await updateInstances('t1', 'p1', undefined, 'u1')).updated).toEqual([]);
    expect(h.updatePage).not.toHaveBeenCalled();
  });
});
