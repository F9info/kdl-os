import { prisma } from '../../config/database.js';
import { deletePage } from '../page-builder/service.js';
import { createDetailPageInstance } from '../../shared/detail-pages/templates.js';
import { siteChrome } from '../sectors/service.js';

export const listCatalog = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.catalogItem.findMany({
    where,
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
};

export const getCatalogById = (id) => prisma.catalogItem.findUnique({ where: { id } });

// Starter content — one representative item's page becomes the shared
// template the first time any catalog item is created for a project; every
// item after that reuses the same template row (see
// shared/detail-pages/templates.js). Mirrors the approved product-page
// mockup: banner -> overview -> applications -> why-buy -> process -> quote.
// Per-item copy for every block below comes from `item.content`, keyed by
// block type (see resolveCatalogBindings) — the props here are only the
// structure/design defaults.
export async function starterPageContent(item) {
  const { header, footer } = await siteChrome(item.project_id);
  const id = (suffix) => `${item.slug}-${suffix}`;
  return {
    root: { props: { title: item.name } },
    zones: {},
    content: [
      ...(header ? [header] : []),
      {
        type: 'ConstructionInnerBanner',
        props: {
          id: id('banner'),
          variant: '1',
          visible: true,
          homeHref: '/',
          imageAlt: item.name,
          subtitle: item.description ?? '',
          backgroundImage: item.image ?? '',
        },
      },
      {
        type: 'ConstructionDisciplineRows',
        props: {
          id: id('overview'),
          sectionEyebrow: '',
          sectionTitle: '',
          sectionSubtitle: '',
          items: [],
          padding: 'md',
          background: 'white',
        },
      },
      {
        type: 'ConstructionIconFeatureGrid',
        props: { id: id('applications'), sectionEyebrow: '', sectionTitle: '', items: [], background: 'white', padding: 'md' },
      },
      { type: 'ConstructionApproachSplit', props: { id: id('why'), padding: 'md', background: 'muted' } },
      {
        type: 'ConstructionProcessSteps',
        props: { id: id('process'), sectionEyebrow: '', sectionTitle: '', items: [], padding: 'md' },
      },
      {
        type: 'ConstructionLeadFormFAQ',
        props: {
          id: id('cta'),
          sectionEyebrow: 'Get a Quote',
          sectionTitle: `Talk to us about ${item.name}`,
          sectionIntroLinkLabel: '',
          sectionIntroLinkHref: '',
          faqs: [],
          checklistItems: '',
          trustStats: [],
          formHeading: 'Request a free quote',
          formSubtext: "Fill this in and we'll call you back.",
          interestOptions: '',
          ctaLabel: 'Get My Free Quote →',
          formPrivacyNote: "We'll only use these details to respond to your enquiry.",
          padding: 'md',
        },
      },
      ...(footer ? [footer] : []),
    ],
  };
}

export const createCatalog = async (data, actorId) => {
  const item = await prisma.catalogItem.create({ data });
  const pageSlug = `catalog-detail-${item.project_id ?? 'global'}-${item.slug}`;
  const page = await createDetailPageInstance(
    {
      projectId: item.project_id,
      typeKey: 'catalog',
      entityId: item.id,
      title: item.name,
      slug: pageSlug,
      seedContentFn: () => starterPageContent(item),
    },
    actorId
  );
  return prisma.catalogItem.update({ where: { id: item.id }, data: { detail_page_id: page.id } });
};

export const updateCatalog = async (id, data) => {
  const { count } = await prisma.catalogItem.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.catalogItem.findUnique({ where: { id } });
};

export const deleteCatalog = async (id, actorId) => {
  const item = await prisma.catalogItem.findUnique({ where: { id } });
  if (!item) return false;
  const { count } = await prisma.catalogItem.deleteMany({ where: { id } });
  if (count > 0 && item.detail_page_id) {
    await deletePage(item.detail_page_id, actorId).catch(() => {});
  }
  return count > 0;
};

// One-time backfill for items created before `detail_page_id` existed —
// `createCatalog` handles this automatically going forward. Safe to re-run.
export const backfillDetailPages = async (actorId) => {
  const missing = await prisma.catalogItem.findMany({ where: { detail_page_id: null } });
  for (const item of missing) {
    const pageSlug = `catalog-detail-${item.project_id ?? 'global'}-${item.slug}`;
    const page = await createDetailPageInstance(
      {
        projectId: item.project_id,
        typeKey: 'catalog',
        entityId: item.id,
        title: item.name,
        slug: pageSlug,
        seedContentFn: () => starterPageContent(item),
      },
      actorId
    );
    await prisma.catalogItem.update({ where: { id: item.id }, data: { detail_page_id: page.id } });
  }
  return missing.length;
};

// The one place CatalogItem's own field names enter the generic Details
// Page system (registerDetailPageType's resolveEntityBindings) — mirrors
// sectors/service.js's resolveSectorBindings exactly. Pure: never mutates
// templateData.
export function resolveCatalogBindings(templateData, item) {
  const data = JSON.parse(JSON.stringify(templateData));
  if (data.root?.props) data.root.props.title = item.name;
  for (const block of data.content ?? []) {
    if (block.type === 'ConstructionInnerBanner') {
      block.props.imageAlt = item.name;
      block.props.subtitle = item.description || block.props.subtitle;
      block.props.backgroundImage = item.image || block.props.backgroundImage;
    } else if (block.type === 'Text') {
      block.props.text = item.brand_tag || block.props.text;
    } else if (block.type === 'ConstructionLeadFormFAQ') {
      block.props.sectionTitle = `Talk to us about ${item.name}`;
    }
    // Item-specific section copy wins over the template's defaults; it never
    // carries variant/padding/background keys, so design stays template-driven.
    Object.assign(block.props, item.content?.[block.type]);
  }
  return data;
}

// Public read for the dynamic `/catalog/[slug]` route.
export const getPublicCatalogBySlug = async (slug, projectId) => {
  const where = { slug };
  if (projectId) where.project_id = projectId;
  const item = await prisma.catalogItem.findFirst({ where: { ...where, is_active: true } });
  if (!item) return null;

  const pageRow = item.detail_page_id
    ? await prisma.builderPage.findFirst({
        where: { id: item.detail_page_id, status: 'PUBLISHED', deleted_at: null },
        select: { data: true, title: true, template_id: true },
      })
    : null;
  if (!pageRow) return { item, page: null };

  let data = pageRow.data;
  if (pageRow.template_id) {
    const template = await prisma.detailPageTemplate.findUnique({ where: { id: pageRow.template_id } });
    if (template) data = resolveCatalogBindings(template.data, item);
  }

  return { item, page: { data, title: pageRow.title } };
};
