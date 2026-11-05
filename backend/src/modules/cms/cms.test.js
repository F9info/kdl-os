import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyCmsSite, seedCmsSamples, CMS_PAGES, SAMPLE_GALLERY } from './pages.js';
import {
  STARTER_PAGES,
  navLinksFor,
  headerLinksFor,
  buildStarterPage,
} from '../projects/starter-site.js';

const baseLinks = navLinksFor(STARTER_PAGES);
const fullLinks = navLinksFor([...STARTER_PAGES, ...CMS_PAGES]);

const row = (slug, links = baseLinks) => ({
  id: `id-${slug}`,
  slug,
  data: {
    root: { props: {} },
    content: [
      { type: 'NavBar', props: { links } },
      { type: 'Footer', props: { links } },
    ],
    zones: {},
  },
});

function client({
  answer = 'yes',
  existing = [],
  starterRows = STARTER_PAGES.map((p) => row(p.slug)),
} = {}) {
  return {
    appSetting: { findUnique: vi.fn().mockResolvedValue(answer ? { value: answer } : null) },
    project: { findFirst: vi.fn().mockResolvedValue({ id: 'p1' }) },
    builderPage: {
      findFirst: vi.fn(async ({ where }) => (existing.includes(where.slug) ? { id: 'x' } : null)),
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue(starterRows),
      update: vi.fn().mockResolvedValue({}),
    },
    menu: { upsert: vi.fn().mockResolvedValue({ id: 'm1' }) },
    menuItem: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
    faqEntry: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    galleryItem: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    testimonial: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    teamMember: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    catalogItem: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    workCategory: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    sector: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
    projectCaseStudy: { count: vi.fn().mockResolvedValue(0), createMany: vi.fn() },
  };
}

describe('applyCmsSite', () => {
  it('does nothing unless the admin chose a front-end website', async () => {
    for (const answer of ['no', null]) {
      const c = client({ answer });
      expect(await applyCmsSite(c)).toEqual({ created: [], patched: [] });
      expect(c.builderPage.create).not.toHaveBeenCalled();
    }
  });

  it('creates the Gallery page (published, default project) and links it from the starter menus', async () => {
    const c = client();
    const r = await applyCmsSite(c, { actorId: 'u1' });
    expect(r.created).toEqual(CMS_PAGES.map((p) => p.slug));
    expect(CMS_PAGES).toHaveLength(7);
    const data = c.builderPage.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ slug: 'gallery', status: 'PUBLISHED', project_id: 'p1' });
    expect(data.data.content.some((b) => b.type === 'GalleryGrid')).toBe(true);
    expect(r.patched).toHaveLength(5);
    expect(c.builderPage.create).toHaveBeenCalledTimes(7);
    const patched = c.builderPage.update.mock.calls[0][0].data.data.content;
    expect(patched[0].props.links).toBe(headerLinksFor([...STARTER_PAGES, ...CMS_PAGES]));
    expect(patched[0].props.links.split('\n')).toHaveLength(7);
    expect(patched[1].props.links).toBe(fullLinks);
    // every new page is also added to the header (main pages only) and footer menus
    expect(c.menuItem.create.mock.calls.length).toBeGreaterThanOrEqual(7);
  });

  it('is idempotent: existing pages are skipped', async () => {
    const c = client({ existing: CMS_PAGES.map((p) => p.slug) });
    expect((await applyCmsSite(c)).created).toEqual([]);
  });

  it('never rewrites a menu the user already edited', async () => {
    const edited = STARTER_PAGES.map((p) => row(p.slug, 'My|/custom'));
    const c = client({ starterRows: edited });
    expect((await applyCmsSite(c)).patched).toEqual([]);
    expect(c.builderPage.update).not.toHaveBeenCalled();
  });
});

describe('seedCmsSamples', () => {
  it('adds sample FAQ and gallery rows only to an empty project', async () => {
    const c = client();
    await seedCmsSamples(c);
    expect(c.faqEntry.createMany.mock.calls[0][0].data).toHaveLength(5);
    expect(c.galleryItem.createMany.mock.calls[0][0].data).toHaveLength(SAMPLE_GALLERY.length);
    for (const m of [
      'testimonial',
      'teamMember',
      'catalogItem',
      'workCategory',
      'sector',
      'projectCaseStudy',
    ])
      expect(c[m].createMany, m).toHaveBeenCalledTimes(1);
    const full = client();
    for (const m of [
      'faqEntry',
      'galleryItem',
      'testimonial',
      'teamMember',
      'catalogItem',
      'workCategory',
      'sector',
      'projectCaseStudy',
    ])
      full[m].count.mockResolvedValue(2);
    await seedCmsSamples(full);
    for (const m of [
      'faqEntry',
      'galleryItem',
      'testimonial',
      'teamMember',
      'catalogItem',
      'workCategory',
      'sector',
      'projectCaseStudy',
    ])
      expect(full[m].createMany, m).not.toHaveBeenCalled();
  });
});

describe('starter FAQ page', () => {
  it('uses the FaqList block with a built-in fallback', () => {
    const faq = buildStarterPage('faq', 'FAQ', STARTER_PAGES).content.find(
      (b) => b.type === 'FaqList'
    );
    expect(faq.props.source).toBe('module');
    expect(faq.props.items.split('\n')).toHaveLength(5);
  });
});
