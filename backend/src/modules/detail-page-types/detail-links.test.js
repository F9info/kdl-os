import { describe, it, expect, vi } from 'vitest';

const header = { type: 'ConstructionHeader', props: { live: 1, links: 'Contact|/p/demo-contact' } };
const rows = [
  { id: 'c', slug: 'demo-contact', title: 'Contact', route_key: 'contact', status: 'PUBLISHED', data: { content: [header] } },
  { id: 's', slug: 'demo-services', title: 'Services', route_key: 'services', status: 'PUBLISHED', data: { content: [header] } },
];
const prisma = {
  detailPageType: { findFirst: vi.fn(async () => ({ type_key: 'service' })) },
  detailPageEntry: { findFirst: vi.fn(async () => ({ id: 'e', detail_page_id: 'd' })) },
  builderPage: {
    findFirst: vi.fn(async () => ({
      title: 'T',
      template_id: null,
      data: {
        content: [
          { type: 'Button', props: { label: 'Talk to Us', href: '/p/demo-contact' } },
          { type: 'Text', props: { text: 'See /p/demo-services and /p/not-a-page' } },
        ],
      },
    })),
    findMany: vi.fn(async () => rows),
  },
};
vi.mock('../../config/database.js', () => ({ prisma }));

const { getPublicEntry } = await import('./entries.service.js');

describe('getPublicEntry links', () => {
  it('turns /p/<slug> links in the page into the routes the site serves', async () => {
    const { page } = await getPublicEntry('p1', 'service', 'page1');
    const json = JSON.stringify(page.data);
    expect(json).toContain('"href":"/contact"');
    expect(json).toContain('See /services and /p/not-a-page'); // unknown slugs are left as written
    expect(json).not.toContain('/p/demo-');
  });

  it('also cleans the links inside the site chrome shown around the page', async () => {
    const { page } = await getPublicEntry('p1', 'service', 'page1');
    const chrome = page.data.content.find((b) => b.type === 'ConstructionHeader');
    expect(chrome.props.links).toBe('Contact|/contact');
  });
});
