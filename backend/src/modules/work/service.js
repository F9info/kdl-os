import { prisma } from '../../config/database.js';
import { createPage, updatePage, deletePage } from '../page-builder/service.js';
import { siteChrome } from '../sectors/service.js';

export const listWork = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.workCategory.findMany({
    where,
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
};

export const getWorkById = (id) => prisma.workCategory.findUnique({ where: { id } });

export const getPublicWorkBySlug = async (slug, projectId) => {
  const where = { slug, is_active: true };
  if (projectId) where.project_id = projectId;
  const item = await prisma.workCategory.findFirst({ where });
  if (!item) return null;
  const page = item.detail_page_id
    ? await prisma.builderPage.findFirst({
        where: { id: item.detail_page_id, status: 'PUBLISHED', deleted_at: null },
        select: { data: true, title: true },
      })
    : null;
  return { item, page };
};

// Starter content — one ConstructionDisciplineRows block, empty `items`.
// Real per-category cards (client segments, photos, locations) are filled in
// by the seeder (seed-content.js), same as sectors' real copy comes from its
// own seeder rather than this starter shape.
async function starterPageContent(work) {
  const { header, footer } = await siteChrome(work.project_id);
  return {
    root: { props: { title: work.name } },
    zones: {},
    content: [
      ...(header ? [header] : []),
      {
        type: 'ConstructionInnerBanner',
        props: {
          id: `${work.slug}-banner`,
          variant: '1',
          visible: true,
          homeHref: '/',
          imageAlt: work.name,
          subtitle: work.subtitle ?? '',
          backgroundImage: work.image ?? '',
        },
      },
      {
        type: 'ConstructionDisciplineRows',
        props: {
          id: `${work.slug}-gallery`,
          sectionEyebrow: work.name,
          sectionTitle: work.name,
          sectionSubtitle: '',
          items: [],
          padding: 'md',
          background: 'white',
        },
      },
      ...(footer ? [footer] : []),
    ],
  };
}

export const createWork = async (data, actorId) => {
  const work = await prisma.workCategory.create({ data });
  const pageSlug = `work-detail-${work.project_id ?? 'global'}-${work.slug}`;
  const page = await createPage(
    { title: work.name, slug: pageSlug, data: await starterPageContent(work), project_id: work.project_id },
    actorId
  );
  // createPage always starts a page as DRAFT — the public /work/[slug] route
  // only serves PUBLISHED pages, so a work category would otherwise render
  // as a dead "no page yet" fallback until someone opens the editor and
  // clicks Publish by hand.
  await updatePage(page.id, { status: 'PUBLISHED' }, actorId);
  return prisma.workCategory.update({ where: { id: work.id }, data: { detail_page_id: page.id } });
};

export const updateWork = async (id, data) => {
  const { count } = await prisma.workCategory.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.workCategory.findUnique({ where: { id } });
};

export const deleteWork = async (id, actorId) => {
  const work = await prisma.workCategory.findUnique({ where: { id } });
  if (!work) return false;
  const { count } = await prisma.workCategory.deleteMany({ where: { id } });
  if (count > 0 && work.detail_page_id) {
    await deletePage(work.detail_page_id, actorId).catch(() => {});
  }
  return count > 0;
};
