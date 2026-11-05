import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    builderPage: { findMany: vi.fn(), findFirst: vi.fn() },
    templateEngineRun: { findFirst: vi.fn() },
    templateEngineStage: { findFirst: vi.fn(), update: vi.fn() },
  },
  createPage: vi.fn(),
  updatePage: vi.fn(),
}));
vi.mock('../../config/database.js', () => ({ prisma: mocks.prisma }));
vi.mock('../page-builder/service.js', () => ({ createPage: mocks.createPage, updatePage: mocks.updatePage }));

import { scaffoldPageForLabel } from './scaffold-page.js';

const blk = (type) => ({ type, props: { id: type } });

describe('scaffoldPageForLabel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.prisma.builderPage.findMany.mockResolvedValue([
      { data: { content: [blk('ConstructionTopBar'), blk('ConstructionHeader'), blk('ConstructionInnerBanner'), blk('ConstructionFooter')] } },
    ]);
    mocks.prisma.builderPage.findFirst.mockResolvedValue(null);
    mocks.createPage.mockResolvedValue({ id: 'p1', title: 'Service Detail', slug: 'page-service-detail' });
    mocks.updatePage.mockResolvedValue({ id: 'p1', title: 'Service Detail', slug: 'page-service-detail' });
    mocks.prisma.templateEngineRun.findFirst.mockResolvedValue({ id: 'r1' });
    mocks.prisma.templateEngineStage.findFirst.mockResolvedValue({ id: 's1', outputRef: { pageIds: ['a'], pageKeyToId: { home: 'a' }, pageKeyToTitle: { home: 'Home' } } });
  });

  it('creates a published page with site chrome + titled banner and lists it in the Pages view', async () => {
    const page = await scaffoldPageForLabel('proj', 'Service Detail', 'u1');
    expect(page.slug).toBe('page-service-detail');
    const data = mocks.createPage.mock.calls[0][0].data;
    expect(data.content.map((b) => b.type)).toEqual(['ConstructionTopBar', 'ConstructionHeader', 'ConstructionInnerBanner', 'ConstructionFooter']);
    expect(data.content[2].props.headline).toBe('Service Detail');
    expect(mocks.updatePage).toHaveBeenCalledWith('p1', { status: 'PUBLISHED' }, 'u1');
    const out = mocks.prisma.templateEngineStage.update.mock.calls[0][0].data.outputRef;
    expect(out.pageKeyToId['service-detail']).toBe('p1');
    expect(out.pageIds).toEqual(['a', 'p1']);
  });

  it('picks a free slug when the first is taken', async () => {
    mocks.prisma.builderPage.findFirst.mockResolvedValueOnce({ id: 'x' }).mockResolvedValue(null);
    await scaffoldPageForLabel('proj', 'Service Detail', 'u1');
    expect(mocks.createPage.mock.calls[0][0].slug).toBe('page-service-detail-2');
  });
});
