import { describe, it, expect, vi } from 'vitest';

const prisma = {
  detailPageType: { findFirst: vi.fn(async () => ({ type_key: 'service' })) },
  detailPageEntry: { findFirst: vi.fn(async () => ({ id: 'e', detail_page_id: 'd' })) },
  builderPage: {
    findFirst: vi.fn(async () => ({
      title: 'T',
      template_id: null,
      data: {
        content: [
          { type: 'ConstructionHeader', props: { stale: true } },
          { type: 'ConstructionInnerBanner', props: {} },
          { type: 'ConstructionFooter', props: { stale: true } },
        ],
      },
    })),
    findMany: vi.fn(async () => [
      {
        data: {
          content: [
            { type: 'ConstructionTopBar', props: { live: 1 } },
            { type: 'ConstructionHeader', props: { live: 1 } },
            { type: 'ConstructionFooter', props: { live: 1 } },
          ],
        },
      },
    ]),
  },
};
vi.mock('../../config/database.js', () => ({ prisma }));

const { getPublicEntry } = await import('./entries.service.js');

describe('getPublicEntry chrome', () => {
  it("shows the site's current top bar, header and footer around the page body", async () => {
    const { page } = await getPublicEntry('p1', 'service', 'page1');
    expect(page.data.content.map((b) => [b.type, b.props.live ?? null])).toEqual([
      ['ConstructionTopBar', 1],
      ['ConstructionHeader', 1],
      ['ConstructionInnerBanner', null],
      ['ConstructionFooter', 1],
    ]);
  });
});

describe('new type seeds', () => {
  it('starts with two sample entries that carry a photo, so the banner is never empty', async () => {
    const { sampleEntries, SAMPLE_ENTRY_IMAGE } = await import('./entries.service.js');
    const entries = sampleEntries('Service');
    expect(entries.map((e) => e.slug)).toEqual(['page1', 'page2']);
    expect(entries.every((e) => e.image === SAMPLE_ENTRY_IMAGE && e.body)).toBe(true);
  });
});
