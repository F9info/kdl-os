import { prisma } from '../../config/database.js';
import { deletePage } from '../page-builder/service.js';
import { ensureDetailPageTemplate, createDetailPageInstance } from '../../shared/detail-pages/templates.js';

export const listSectors = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.sector.findMany({
    where,
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
};

export const getSectorById = (id) => prisma.sector.findUnique({ where: { id } });

// Reuses whatever Header/Footer blocks already exist on any other real
// page in this project — keeps a new sector's page visually consistent
// with the rest of the site (nav, brand, footer links) without this
// module needing to know anything about brand-kit/theme resolution
// itself. Works for any project: a brand-new one with no other pages yet
// just gets a starter page with no chrome, same as any first page would.
export async function siteChrome(projectId) {
  if (!projectId) return { header: null, footer: null };
  const candidates = await prisma.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null },
    orderBy: [{ status: 'asc' }, { updated_at: 'desc' }], // PUBLISHED sorts before DRAFT
    select: { data: true },
    take: 10,
  });
  for (const { data } of candidates) {
    const header = data?.content?.find((b) => b.type === 'ConstructionHeader');
    const footer = data?.content?.find((b) => b.type === 'ConstructionFooter');
    if (header || footer) return { header, footer };
  }
  return { header: null, footer: null };
}

// A generic starter page — the SAME reusable block library every other
// page in this app uses (Header/Footer if the project already has any,
// Inner Banner / Text / Lead Form + FAQ for the body), not a
// sector-specific template. Gives every new sector a real, working,
// admin-editable detail page with zero manual page-creation step; the
// admin can add/reorder/replace sections afterward via the normal page
// editor, same as Home/About.
async function starterPageContent(sector) {
  const firstParagraph = (sector.description ?? '').split('\n\n')[0] ?? '';
  const { header, footer } = await siteChrome(sector.project_id);
  return {
    root: { props: { title: sector.name } },
    zones: {},
    content: [
      ...(header ? [header] : []),
      {
        type: 'ConstructionInnerBanner',
        props: {
          id: `${sector.slug}-banner`,
          variant: '1',
          visible: true,
          homeHref: '/',
          imageAlt: sector.name,
          subtitle: firstParagraph,
          backgroundImage: sector.image ?? '',
        },
      },
      {
        type: 'Text',
        props: {
          id: `${sector.slug}-body`,
          variant: '1',
          text: sector.description ?? '',
          align: 'left',
          muted: false,
        },
      },
      {
        type: 'ConstructionLeadFormFAQ',
        props: {
          id: `${sector.slug}-cta`,
          sectionEyebrow: 'Get a Quote',
          sectionTitle: `Talk to us about ${sector.name}`,
          sectionIntroLinkLabel: '',
          sectionIntroLinkHref: '',
          faqs: [],
          checklistItems: '',
          trustStats: [],
          formHeading: 'Request a free quote',
          formSubtext: "Fill this in and we'll call you back.",
          interestOptions:
            'Central AC\nHome Automation\nHome Theater\nCCTV & Security\nFire Safety\nElectrical\nSomething else',
          ctaLabel: 'Get My Free Quote →',
          formPrivacyNote: "We'll only use these details to respond to your enquiry.",
          padding: 'md',
        },
      },
      ...(footer ? [footer] : []),
    ],
  };
}

export const createSector = async (data, actorId) => {
  const sector = await prisma.sector.create({ data });
  // Internal BuilderPage slug — never read by the public route (that
  // resolves sector -> detail_page_id -> page directly), just needs to be
  // globally unique. Namespaced by project so the same sector slug in two
  // different projects doesn't collide.
  const pageSlug = `sector-detail-${sector.project_id ?? 'global'}-${sector.slug}`;
  const page = await createDetailPageInstance(
    {
      projectId: sector.project_id,
      typeKey: 'sectors',
      entityId: sector.id,
      title: sector.name,
      slug: pageSlug,
      // Only used the very first time a project has no sectors template yet
      // — every sector after that shares the same template row.
      seedContentFn: () => starterPageContent(sector),
    },
    actorId
  );
  return prisma.sector.update({ where: { id: sector.id }, data: { detail_page_id: page.id } });
};

export const updateSector = async (id, data) => {
  const { count } = await prisma.sector.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.sector.findUnique({ where: { id } });
};

export const deleteSector = async (id, actorId) => {
  const sector = await prisma.sector.findUnique({ where: { id } });
  if (!sector) return false;
  const { count } = await prisma.sector.deleteMany({ where: { id } });
  if (count > 0 && sector.detail_page_id) {
    await deletePage(sector.detail_page_id, actorId).catch(() => {});
  }
  return count > 0;
};

// One-time backfill for sectors created before `detail_page_id` existed —
// `createSector` handles this automatically for every new sector going
// forward. Safe to re-run: only touches rows that still have no page.
export const backfillDetailPages = async (actorId) => {
  const missing = await prisma.sector.findMany({ where: { detail_page_id: null } });
  for (const sector of missing) {
    const pageSlug = `sector-detail-${sector.project_id ?? 'global'}-${sector.slug}`;
    const page = await createDetailPageInstance(
      {
        projectId: sector.project_id,
        typeKey: 'sectors',
        entityId: sector.id,
        title: sector.name,
        slug: pageSlug,
        seedContentFn: () => starterPageContent(sector),
      },
      actorId
    );
    await prisma.sector.update({ where: { id: sector.id }, data: { detail_page_id: page.id } });
  }
  return missing.length;
};

// The one place Sector's own field names enter the generic Details Page
// system (see registerDetailPageType's `resolveEntityBindings` below) —
// given the shared template's raw data and one sector, swaps that sector's
// own name/description/image into the known bindable spots. Pure: never
// mutates `templateData`.
export function resolveSectorBindings(templateData, sector) {
  const data = JSON.parse(JSON.stringify(templateData));
  if (data.root?.props) data.root.props.title = sector.name;
  const firstParagraph = (sector.description ?? '').split('\n\n')[0]?.trim() ?? '';
  for (const block of data.content ?? []) {
    if (block.type === 'ConstructionInnerBanner') {
      block.props.imageAlt = sector.name;
      block.props.subtitle = firstParagraph || block.props.subtitle;
      block.props.backgroundImage = sector.image || block.props.backgroundImage;
    } else if (block.type === 'ConstructionLeadFormFAQ') {
      block.props.sectionTitle = `Talk to us about ${sector.name}`;
    }
    // Sector's approved copy for this block (keyed by id minus slug prefix).
    const id = block.props?.id;
    if (id) Object.assign(block.props, sector.content?.[id.slice(id.indexOf('-') + 1)]);
  }
  return data;
}

// Public read for the dynamic `/sectors/[slug]` route — one request
// returns both the sector's own base fields (name/description/SEO/etc.)
// and its linked detail page's Puck content, joined server-side rather
// than making the frontend do two round-trips.
export const getPublicSectorBySlug = async (slug, projectId) => {
  const where = { slug };
  if (projectId) where.project_id = projectId;
  const sector = await prisma.sector.findFirst({ where: { ...where, is_active: true } });
  if (!sector) return null;

  const pageRow = sector.detail_page_id
    ? await prisma.builderPage.findFirst({
        where: { id: sector.detail_page_id, status: 'PUBLISHED', deleted_at: null },
        select: { data: true, title: true, template_id: true },
      })
    : null;
  if (!pageRow) return { sector, page: null };

  // Structure/design comes from the shared template (live — every sector
  // reads the same row); this sector's own name/description/image are
  // resolved in here, never baked back into the template itself.
  let data = pageRow.data;
  if (pageRow.template_id) {
    const template = await prisma.detailPageTemplate.findUnique({ where: { id: pageRow.template_id } });
    if (template) data = resolveSectorBindings(template.data, sector);
  }

  return { sector, page: { data, title: pageRow.title } };
};
