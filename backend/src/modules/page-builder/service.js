import { prisma } from '../../config/database.js';
import { resolveForEditor, stripEntityBindings } from '../../shared/detail-pages/resolve.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { enqueueSiteBuild } from '../template-engine/site/queue.js';
import { normalizeData } from '../../shared/numbered-families.js';
import { removePageFromMenus } from '../menus/site-menus.js';
import { unregisterFromWebsiteStage } from '../template-engine/site/unregister-page.js';
import { ensureDefaultSite } from '../projects/sites.js';

export const listPages = async () => {
  return prisma.builderPage.findMany({
    where: { deleted_at: null },
    orderBy: { updated_at: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      updated_at: true,
      project_id: true,
    },
  });
};

// A template-bound instance (see detail-pages.prisma) defers its structure
// to the shared DetailPageTemplate row — the editor should show/edit that,
// not this page's own frozen `data` copy. Transparent to every caller: a
// page with no `template_id` behaves exactly as before.
export const getPage = async (id) => {
  const page = await prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
  if (!page) return null;
  if (page.template_id) {
    const template = await prisma.detailPageTemplate.findUnique({ where: { id: page.template_id } });
    if (template) return { ...page, data: await resolveForEditor(page, template) };
  }
  return page;
};

// Deliberately matches soft-deleted rows too — `slug` is globally @unique
// with no soft-delete awareness, so a deleted page's slug is reserved
// forever; the only caller (template-engine's website driver, crash/orphan
// recovery) needs to find and resurrect whatever row already holds a given
// deterministic slug rather than crash trying to create a duplicate.
export const getPageBySlug = async (slug) => {
  return prisma.builderPage.findFirst({ where: { slug } });
};

export const getPublishedBySlug = async (slug) => {
  return prisma.builderPage.findFirst({
    where: { slug, status: 'PUBLISHED', deleted_at: null },
    select: { slug: true, title: true, data: true, project_id: true },
  });
};

// Which pages a site serves: those assigned to it, plus (for the project's default site) pages that
// predate sites and have no site yet. No site given = no filtering (project-wide, as before sites).
const siteScope = (site) =>
  site?.siteId ? { OR: [{ site_id: site.siteId }, ...(site.isDefault ? [{ site_id: null }] : [])] } : {};

// Clean public URLs: "/" is the site's `home` page and "/<key>" its other pages, where <key> is the
// page key the website stage recorded (slugified title). Falls back to a plain slug match.
// `site` = { siteId, isDefault } from resolvePublicSite; it keeps one site's pages off another's host.
export const getPublishedBySiteKey = async (projectId, key, site) => {
  const select = { slug: true, title: true, data: true, project_id: true };
  const stages = await prisma.templateEngineStage.findMany({
    where: { stage: 'WEBSITE', run: { projectId } },
    orderBy: { run: { createdAt: 'desc' } },
  });
  for (const stage of stages) {
    const id = stage.outputRef?.pageKeyToId?.[key];
    const page =
      id &&
      (await prisma.builderPage.findFirst({
        where: { id, status: 'PUBLISHED', deleted_at: null, ...siteScope(site) },
        select,
      }));
    if (page) return page;
  }
  const bySlug = await prisma.builderPage.findFirst({
    where: { slug: key, project_id: projectId, status: 'PUBLISHED', deleted_at: null, ...siteScope(site) },
    select,
  });
  if (bySlug || key !== 'home' || !site?.siteId || site.isDefault) return bySlug;
  // A landing site's "/" is its first published page (its slug is not literally "home").
  return prisma.builderPage.findFirst({
    where: { site_id: site.siteId, status: 'PUBLISHED', deleted_at: null },
    orderBy: { created_at: 'asc' },
    select,
  });
};

export const createPage = async ({ title, slug, data, project_id }, actorId) => {
  const page = await prisma.builderPage.create({
    data: {
      title,
      slug,
      status: 'DRAFT',
      data: normalizeData(data ?? { root: { props: { title } }, content: [], zones: {} }),
      created_by: actorId,
      project_id,
      site_id: await ensureDefaultSite(prisma, project_id),
    },
  });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'created',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" created`,
  });
  enqueueSiteBuild(page.project_id);
  return page;
};

export const updatePage = async (id, rawPatch, actorId) => {
  const patch = rawPatch.data === undefined ? rawPatch : { ...rawPatch, data: normalizeData(rawPatch.data) };
  // Same transparency as getPage above: a structural save on a
  // template-bound instance writes through to the shared template (every
  // sibling instance re-resolves from it on next load), not this page's own
  // row — that's what makes the layout "always-live". `title`/`status`
  // still belong to this page alone.
  if (patch.data !== undefined) {
    const existing = await prisma.builderPage.findFirst({ where: { id } });
    if (existing?.template_id) {
      const { data: incoming, ...rest } = patch;
      const template = await prisma.detailPageTemplate.findUnique({ where: { id: existing.template_id } });
      const data = await stripEntityBindings(existing, template, incoming);
      await prisma.detailPageTemplate.update({
        where: { id: existing.template_id },
        data: { data },
      });
      const page = Object.keys(rest).length
        ? await prisma.builderPage.update({ where: { id }, data: rest })
        : existing;
      writeActivityAsync({
        actor: actorId,
        module: 'page-builder',
        action: rest.status === 'PUBLISHED' ? 'published' : 'updated',
        subject_type: 'BuilderPage',
        subject_id: id,
        description: `Page "${page.title}" ${rest.status === 'PUBLISHED' ? 'published' : 'updated'} (shared template)`,
      });
      enqueueSiteBuild(existing.project_id);
      return { ...page, data };
    }
  }
  const page = await prisma.builderPage.update({ where: { id }, data: patch });
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: patch.status === 'PUBLISHED' ? 'published' : 'updated',
    subject_type: 'BuilderPage',
    subject_id: page.id,
    description: `Page "${page.title}" ${patch.status === 'PUBLISHED' ? 'published' : 'updated'}`,
  });
  enqueueSiteBuild(page.project_id);
  return page;
};

export const deletePage = async (id, actorId) => {
  const page = await prisma.builderPage.update({
    where: { id },
    data: { deleted_at: new Date() },
  });
  // A deleted page must not leave a dead link in the header/footer menus.
  try {
    await removePageFromMenus(prisma, page);
  } catch {
    /* menus are optional — never block a page delete */
  }
  await unregisterFromWebsiteStage(page.project_id, id).catch(() => {});
  writeActivityAsync({
    actor: actorId,
    module: 'page-builder',
    action: 'deleted',
    subject_type: 'BuilderPage',
    subject_id: id,
    description: `Page "${page.title}" deleted`,
  });
  enqueueSiteBuild(page.project_id);
  return page;
};
