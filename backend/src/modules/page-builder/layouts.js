// T11: duplicate a page, and reusable page layouts. A layout is a row of the shared `templates` table
// (T10) with kind PAGE, so no new table. Layouts are install-wide, like the landing templates.
import { prisma } from '../../config/database.js';
import { createPage } from './service.js';
import { workingData } from './versions.js';

const KIND = 'PAGE';
const PUBLIC = { key: true, name: true, description: true, created_at: true };
const httpError = (status, message) => Object.assign(new Error(message), { status });
const clone = (v) => JSON.parse(JSON.stringify(v));

// Slugs are unique per project and a soft-deleted page keeps its slug, so look at deleted rows too.
async function freeSlug(base, projectId, client) {
  for (let n = 1; n < 100; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await client.builderPage.findFirst({ where: { slug, project_id: projectId }, select: { id: true } }))) return slug;
  }
  throw httpError(409, 'Could not find a free slug');
}

const loadPage = async (id, projectId, client) => {
  const page = await client.builderPage.findFirst({ where: { id, project_id: projectId, deleted_at: null } });
  if (!page) throw httpError(404, 'Page not found');
  // A details-page instance gets its structure from a shared template; copying its row would copy nothing useful.
  if (page.template_id) throw httpError(409, 'A details page follows its template; duplicate the template instead');
  return page;
};

/** Copy of a page (its pending draft if it has one) as a new DRAFT in the same project. */
export async function duplicatePage(id, { title, slug }, actorId, projectId, client = prisma) {
  const src = await loadPage(id, projectId, client);
  const copyTitle = title?.trim() || `${src.title} (copy)`;
  if (slug && (await client.builderPage.findFirst({ where: { slug, project_id: projectId }, select: { id: true } }))) {
    throw httpError(409, 'That slug is already used in this project');
  }
  const page = await createPage(
    { title: copyTitle, slug: slug || (await freeSlug(`${src.slug}-copy`, projectId, client)), data: clone(workingData(src)), project_id: projectId },
    actorId
  );
  if (!src.seo) return page;
  const { canonical: _canonical, ...seo } = src.seo; // a copy must not claim the original's canonical address
  return client.builderPage.update({ where: { id: page.id }, data: { seo } });
}

export const listLayouts = (client = prisma) =>
  client.template.findMany({ where: { kind: KIND, deleted_at: null }, orderBy: { created_at: 'desc' }, select: PUBLIC });

/** Save a page's content as a reusable layout. */
export async function saveAsLayout(pageId, { name, description = '' }, actorId, projectId, client = prisma) {
  const src = await loadPage(pageId, projectId, client);
  const key = `page-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'layout'}-${Math.random().toString(36).slice(2, 7)}`;
  return client.template.create({
    data: { key, kind: KIND, name, description, data: clone(workingData(src)), builtin: false, created_by: actorId },
    select: PUBLIC,
  });
}

/** A new DRAFT page in this project with a layout's content. */
export async function createFromLayout({ layout_key, title, slug }, actorId, projectId, client = prisma) {
  const layout = await client.template.findFirst({ where: { key: layout_key, kind: KIND, deleted_at: null } });
  if (!layout) throw httpError(404, 'Unknown layout');
  if (await client.builderPage.findFirst({ where: { slug, project_id: projectId }, select: { id: true } })) {
    throw httpError(409, 'That slug is already used in this project');
  }
  const data = clone(layout.data);
  data.root = { ...data.root, props: { ...data.root?.props, title } };
  return createPage({ title, slug, data, project_id: projectId }, actorId);
}
