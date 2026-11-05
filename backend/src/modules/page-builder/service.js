import { prisma } from '../../config/database.js';
import { resolveForEditor, stripEntityBindings } from '../../shared/detail-pages/resolve.js';
import { cleanSeo } from './seo.js';
import { validatePage } from './validate.js';
import { publishPage, unpublishPage, restoreVersion, listVersions, withPublishState, workingData } from './versions.js';
import { revalidatePublicPages } from '../../shared/frontend-revalidate.js';
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
    if (template) return withPublishState({ ...page, data: await resolveForEditor(page, template) });
  }
  return withPublishState(page);
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
    select: { slug: true, title: true, data: true, seo: true, project_id: true, site_id: true },
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
  const select = { slug: true, title: true, data: true, seo: true, project_id: true, site_id: true };
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

/**
 * Public URLs of a site's published pages, for sitemap.xml. noindex pages are left out. On the
 * default site a page keeps its clean URL ("/" for home, "/<key>"), anything else is "/p/<slug>".
 * Template-bound detail pages have their own routes and are not listed here.
 */
export const listSitemapEntries = async (projectId, site) => {
  const pages = await prisma.builderPage.findMany({
    where: { project_id: projectId, status: 'PUBLISHED', deleted_at: null, template_id: null, ...siteScope(site) },
    orderBy: { created_at: 'asc' },
    select: { id: true, slug: true, seo: true, updated_at: true },
  });
  const idToKey = new Map();
  if (site?.isDefault) {
    const stages = await prisma.templateEngineStage.findMany({
      where: { stage: 'WEBSITE', run: { projectId } },
      orderBy: { run: { createdAt: 'desc' } },
    });
    for (const stage of stages) {
      for (const [key, id] of Object.entries(stage.outputRef?.pageKeyToId ?? {})) {
        if (!idToKey.has(id)) idToKey.set(id, key);
      }
    }
  }
  return pages
    .filter((p) => !cleanSeo(p.seo)?.noindex)
    .map((p) => {
      const key = idToKey.get(p.id);
      const path = key === 'home' ? '/' : key ? `/${key}` : `/p/${p.slug}`;
      return { path, lastmod: p.updated_at };
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
  const patch = {
    ...rawPatch,
    ...(rawPatch.data === undefined ? {} : { data: normalizeData(rawPatch.data) }),
    // Prisma needs Prisma.DbNull to clear a Json column, so an empty SEO is stored as {}.
    ...(rawPatch.seo === undefined ? {} : { seo: cleanSeo(rawPatch.seo) ?? {} }),
  };
  const existing = await prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw Object.assign(new Error('Page not found'), { status: 404 });

  // A structural save on a template-bound instance writes through to the shared template (every
  // sibling instance re-resolves from it on next load), not this page's own row — that's what
  // makes the layout "always-live". `title`/`status` still belong to this page alone. These pages
  // are not versioned.
  if (existing.template_id && patch.data !== undefined) {
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

  if (!existing.template_id) {
    // Publishing records a version and makes the content live; unpublishing takes it offline.
    if (patch.status === 'PUBLISHED') return publishPage(existing, patch, actorId);
    if (patch.status === 'DRAFT') return unpublishPage(existing, patch, actorId);
    // Editing a live page (autosave) only changes its draft: visitors keep seeing the live content
    // until the next publish.
    if (patch.data !== undefined && existing.status === 'PUBLISHED') {
      const { data, ...rest } = patch;
      const page = await prisma.builderPage.update({ where: { id }, data: { ...rest, draft_data: data } });
      if (rest.title !== undefined || rest.seo !== undefined) revalidatePublicPages();
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
  if (patch.status !== undefined || patch.title !== undefined || patch.seo !== undefined) revalidatePublicPages();
  return page;
};

/** POST /:id/publish — optional body { data, title, seo } is saved as part of publishing. */
export const publish = async (id, body, actorId) => {
  const { force = false, ...content } = body;
  const existing = await prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw Object.assign(new Error('Page not found'), { status: 404 });
  // Pre-publish checks (T6.4): problems that are actually broken stop the publish unless the author
  // chose "publish anyway". Template-bound pages and system callers of updatePage are not checked.
  if (!force && !existing.template_id) {
    const result = await validatePage(candidateOf(existing, content));
    if (!result.can_publish) {
      throw Object.assign(new Error('This page has problems to fix before publishing.'), {
        status: 422,
        errors: { code: 'PUBLISH_VALIDATION_FAILED', issues: result.issues },
      });
    }
  }
  return updatePage(id, { ...content, status: 'PUBLISHED' }, actorId);
};

// What would go live: the body's content, else the pending draft, else the live content.
const candidateOf = (existing, content) => ({
  slug: existing.slug,
  project_id: existing.project_id,
  title: content.title ?? existing.title,
  data: content.data ?? workingData(existing),
  seo: content.seo !== undefined ? content.seo : existing.seo,
});

/**
 * Checks what Publish would put live: the given content (data/title/seo, as the editor holds it),
 * else the saved working copy. Template pages have nothing to check.
 */
export const checkPage = async (id, content = {}) => {
  const existing = await prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw Object.assign(new Error('Page not found'), { status: 404 });
  if (existing.template_id) return { issues: [], errors: 0, warnings: 0, can_publish: true };
  return validatePage(candidateOf(existing, content));
};

export const unpublish = (id, actorId) => updatePage(id, { status: 'DRAFT' }, actorId);

export const restore = async (id, versionId, actorId) => {
  const existing = await prisma.builderPage.findFirst({ where: { id, deleted_at: null } });
  if (!existing) throw Object.assign(new Error('Page not found'), { status: 404 });
  return restoreVersion(existing, versionId, actorId);
};

export { listVersions };

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
