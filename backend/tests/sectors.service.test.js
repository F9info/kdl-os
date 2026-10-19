import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/config/database.js', () => ({
  prisma: {
    sector: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    builderPage: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    detailPageTemplate: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../src/modules/page-builder/service.js', () => ({
  deletePage: vi.fn(),
}));

vi.mock('../src/shared/detail-pages/templates.js', () => ({
  ensureDetailPageTemplate: vi.fn(),
  createDetailPageInstance: vi.fn(),
}));

import { prisma } from '../src/config/database.js';
import { createDetailPageInstance } from '../src/shared/detail-pages/templates.js';
import {
  listSectors,
  getSectorById,
  createSector,
  updateSector,
  deleteSector,
  resolveSectorBindings,
  siteChrome,
  getPublicSectorBySlug,
} from '../src/modules/sectors/service.js';

const prismaMock = vi.mocked(prisma, { deep: true });

beforeEach(() => vi.clearAllMocks());

// ---- resolveSectorBindings (pure function) ---------------------------------

describe('sectors service — resolveSectorBindings', () => {
  const baseTemplate = {
    root: { props: { title: 'Old Title' } },
    content: [
      { type: 'ConstructionInnerBanner', props: { id: 'test-banner', imageAlt: 'Old', subtitle: '', backgroundImage: '' } },
      { type: 'Text', props: { id: 'test-body', text: 'Old text' } },
      { type: 'ConstructionLeadFormFAQ', props: { id: 'test-cta', sectionTitle: 'Old CTA' } },
    ],
    zones: {},
  };

  it('updates root title from sector.name', () => {
    const sector = { name: 'HVAC', description: '', image: null, slug: 'hvac', content: {} };
    const result = resolveSectorBindings(baseTemplate, sector);
    expect(result.root.props.title).toBe('HVAC');
  });

  it('updates InnerBanner imageAlt and subtitle from sector', () => {
    const sector = { name: 'Electrical', description: 'First paragraph.\n\nSecond paragraph.', image: '/img/elec.jpg', slug: 'electrical', content: {} };
    const result = resolveSectorBindings(baseTemplate, sector);
    const banner = result.content.find((b) => b.type === 'ConstructionInnerBanner');
    expect(banner.props.imageAlt).toBe('Electrical');
    expect(banner.props.subtitle).toBe('First paragraph.');
    expect(banner.props.backgroundImage).toBe('/img/elec.jpg');
  });

  it('updates LeadFormFAQ sectionTitle', () => {
    const sector = { name: 'Solar', description: '', image: null, slug: 'solar', content: {} };
    const result = resolveSectorBindings(baseTemplate, sector);
    const cta = result.content.find((b) => b.type === 'ConstructionLeadFormFAQ');
    expect(cta.props.sectionTitle).toBe('Talk to us about Solar');
  });

  it('does not mutate the original templateData', () => {
    const sector = { name: 'New', description: 'Desc', image: null, slug: 'new', content: {} };
    resolveSectorBindings(baseTemplate, sector);
    expect(baseTemplate.root.props.title).toBe('Old Title');
  });

  it('keeps existing banner image when sector.image is null', () => {
    const sector = { name: 'X', description: '', image: null, slug: 'x', content: {} };
    const tpl = JSON.parse(JSON.stringify(baseTemplate));
    tpl.content[0].props.backgroundImage = '/existing.jpg';
    const result = resolveSectorBindings(tpl, sector);
    const banner = result.content.find((b) => b.type === 'ConstructionInnerBanner');
    expect(banner.props.backgroundImage).toBe('/existing.jpg');
  });
});

// ---- siteChrome ------------------------------------------------------------

describe('sectors service — siteChrome', () => {
  it('returns null header and footer when projectId is null', async () => {
    const result = await siteChrome(null);
    expect(result).toEqual({ header: null, footer: null });
    expect(prismaMock.builderPage.findMany).not.toHaveBeenCalled();
  });

  it('returns header and footer blocks extracted from existing pages', async () => {
    const header = { type: 'ConstructionHeader', props: {} };
    const footer = { type: 'ConstructionFooter', props: {} };
    prismaMock.builderPage.findMany.mockResolvedValue([
      { data: { content: [header, footer] } },
    ]);

    const result = await siteChrome('proj1');

    expect(result.header).toEqual(header);
    expect(result.footer).toEqual(footer);
  });

  it('returns null when no existing pages have chrome blocks', async () => {
    prismaMock.builderPage.findMany.mockResolvedValue([
      { data: { content: [{ type: 'Hero', props: {} }] } },
    ]);

    const result = await siteChrome('proj1');

    expect(result).toEqual({ header: null, footer: null });
  });
});

// ---- listSectors -----------------------------------------------------------

describe('sectors service — listSectors', () => {
  it('returns all sectors ordered by order asc', async () => {
    const rows = [{ id: 's1', name: 'HVAC', is_active: true }];
    prismaMock.sector.findMany.mockResolvedValue(rows);

    const result = await listSectors({});

    expect(prismaMock.sector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: expect.any(Array) })
    );
    expect(result).toEqual(rows);
  });

  it('filters by is_active when passed as string "true"', async () => {
    prismaMock.sector.findMany.mockResolvedValue([]);

    await listSectors({ is_active: 'true' });

    expect(prismaMock.sector.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_active: true }) })
    );
  });
});

// ---- getSectorById ---------------------------------------------------------

describe('sectors service — getSectorById', () => {
  it('returns null when sector not found', async () => {
    prismaMock.sector.findUnique.mockResolvedValue(null);
    expect(await getSectorById('missing')).toBeNull();
  });
});

// ---- createSector ----------------------------------------------------------

describe('sectors service — createSector', () => {
  it('creates sector and links a detail page', async () => {
    const created = { id: 's1', name: 'HVAC', slug: 'hvac', project_id: 'proj1', detail_page_id: null };
    const page = { id: 'page1' };
    const withPage = { ...created, detail_page_id: 'page1' };

    prismaMock.sector.create.mockResolvedValue(created);
    vi.mocked(createDetailPageInstance).mockResolvedValue(page);
    prismaMock.sector.update.mockResolvedValue(withPage);
    prismaMock.builderPage.findMany.mockResolvedValue([]); // siteChrome — no existing chrome

    const result = await createSector({ name: 'HVAC', slug: 'hvac', project_id: 'proj1' }, 'actor1');

    expect(createDetailPageInstance).toHaveBeenCalled();
    expect(prismaMock.sector.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { detail_page_id: 'page1' } })
    );
    expect(result.detail_page_id).toBe('page1');
  });
});

// ---- updateSector ----------------------------------------------------------

describe('sectors service — updateSector', () => {
  it('returns null when sector not found', async () => {
    prismaMock.sector.updateMany.mockResolvedValue({ count: 0 });
    expect(await updateSector('missing', { name: 'X' })).toBeNull();
  });

  it('returns updated sector when found', async () => {
    prismaMock.sector.updateMany.mockResolvedValue({ count: 1 });
    const updated = { id: 's1', name: 'HVAC 2' };
    prismaMock.sector.findUnique.mockResolvedValue(updated);

    expect(await updateSector('s1', { name: 'HVAC 2' })).toEqual(updated);
  });
});

// ---- deleteSector ----------------------------------------------------------

describe('sectors service — deleteSector', () => {
  it('returns false when sector not found', async () => {
    prismaMock.sector.findUnique.mockResolvedValue(null);
    expect(await deleteSector('missing', 'actor1')).toBe(false);
  });

  it('deletes sector and soft-deletes its detail page', async () => {
    const sector = { id: 's1', detail_page_id: 'page1' };
    prismaMock.sector.findUnique.mockResolvedValue(sector);
    prismaMock.sector.deleteMany.mockResolvedValue({ count: 1 });

    const pageBuilderService = await import('../src/modules/page-builder/service.js');
    vi.mocked(pageBuilderService.deletePage).mockResolvedValue({ id: 'page1' });

    const result = await deleteSector('s1', 'actor1');

    expect(result).toBe(true);
    expect(pageBuilderService.deletePage).toHaveBeenCalledWith('page1', 'actor1');
  });
});

// ---- getPublicSectorBySlug -------------------------------------------------

describe('sectors service — getPublicSectorBySlug', () => {
  it('returns null when no active sector matches slug', async () => {
    prismaMock.sector.findFirst.mockResolvedValue(null);
    expect(await getPublicSectorBySlug('ghost', 'proj1')).toBeNull();
  });

  it('returns sector with page:null when sector has no published page', async () => {
    const sector = { id: 's1', slug: 'hvac', detail_page_id: 'page1', is_active: true };
    prismaMock.sector.findFirst.mockResolvedValue(sector);
    prismaMock.builderPage.findFirst.mockResolvedValue(null);

    const result = await getPublicSectorBySlug('hvac', 'proj1');

    expect(result.sector).toEqual(sector);
    expect(result.page).toBeNull();
  });

  it('returns resolved bindings when sector has a published template-bound page', async () => {
    const sector = { id: 's1', slug: 'hvac', name: 'HVAC', description: '', image: null, detail_page_id: 'page1', is_active: true, content: {} };
    const pageRow = { data: null, title: 'HVAC Page', template_id: 'tmpl1' };
    const template = {
      id: 'tmpl1',
      data: {
        root: { props: { title: 'Template' } },
        content: [
          { type: 'ConstructionInnerBanner', props: { id: 'hvac-banner', imageAlt: '', subtitle: '', backgroundImage: '' } },
          { type: 'ConstructionLeadFormFAQ', props: { id: 'hvac-cta', sectionTitle: '' } },
        ],
        zones: {},
      },
    };

    prismaMock.sector.findFirst.mockResolvedValue(sector);
    prismaMock.builderPage.findFirst.mockResolvedValue(pageRow);
    prismaMock.detailPageTemplate.findUnique.mockResolvedValue(template);

    const result = await getPublicSectorBySlug('hvac', 'proj1');

    expect(result.sector).toEqual(sector);
    expect(result.page.data.root.props.title).toBe('HVAC');
  });
});
