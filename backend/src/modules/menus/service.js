import { prisma } from '../../config/database.js';
import { enqueueSiteBuild } from '../template-engine/site/queue.js';
import { scaffoldPageForLabel } from './scaffold-page.js';
import { renameInWebsiteStage } from '../template-engine/site/unregister-page.js';
import { deletePage } from '../page-builder/service.js';
import { createType, deleteType } from '../detail-page-types/entries.service.js';
import { getDetailPageType } from '../../shared/detail-pages/registry.js';
import { slugify } from '../../shared/utils/slug.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import { getFooterSameAsHeader, setFooterSameAsHeader } from './site-menus.js';

const MAX_DEPTH = 3;

// A menu edit changes the generated site of the menu's project.
const touchMenu = async (menuId) => {
  if (!menuId) return;
  const m = await prisma.menu.findUnique({ where: { id: menuId }, select: { project_id: true } });
  enqueueSiteBuild(m?.project_id);
};

function buildTree(flatItems) {
  const byId = new Map(flatItems.map((i) => [i.id, { ...i, children: [] }]));
  const roots = [];
  for (const item of byId.values()) {
    if (item.parent_id && byId.has(item.parent_id)) {
      byId.get(item.parent_id).children.push(item);
    } else {
      roots.push(item);
    }
  }
  const sortRec = (list) => {
    list.sort((a, b) => a.order - b.order);
    for (const item of list) sortRec(item.children);
  };
  sortRec(roots);
  return roots;
}

export const listMenus = async (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  const menus = await prisma.menu.findMany({ where, include: { items: true } });
  return menus.map((m) => ({ ...m, items: buildTree(m.items) }));
};

export const getMenuById = async (id) => {
  const menu = await prisma.menu.findUnique({ where: { id }, include: { items: true } });
  if (!menu) return null;
  return { ...menu, items: buildTree(menu.items) };
};

// Public read — active items only, tree-shaped, filtered by (project_id, key).
// Public links use the site's clean URLs ("/", "/about") for pages the website stage keyed;
// anything else (custom pages, detail pages, external links) keeps its stored url.
async function withCleanUrls(projectId, items) {
  const isPageUrl = (i) => i.url?.startsWith('/p/');
  if (!projectId || !items.some(isPageUrl)) return items;
  const stages = await prisma.templateEngineStage.findMany({
    where: { stage: 'WEBSITE', run: { projectId } },
    orderBy: { run: { createdAt: 'asc' } }, // latest run last, so it wins
  });
  const keyByPage = new Map();
  for (const st of stages) for (const [k, id] of Object.entries(st.outputRef?.pageKeyToId ?? {})) keyByPage.set(id, k);
  // Items may carry only the url (no page_id) — resolve those through the page's slug.
  const slugs = items.filter((i) => isPageUrl(i) && !i.page_id).map((i) => i.url.slice(3));
  const idBySlug = new Map(
    (await prisma.builderPage.findMany({ where: { slug: { in: slugs }, project_id: projectId, deleted_at: null }, select: { id: true, slug: true } })).map(
      (p) => [p.slug, p.id]
    )
  );
  return items.map((i) => {
    if (!isPageUrl(i)) return i;
    const k = keyByPage.get(i.page_id ?? idBySlug.get(i.url.slice(3)));
    return k ? { ...i, url: k === 'home' ? '/' : `/${k}` } : i;
  });
}

// A detail menu item stands for a LAYOUT, not a page: the public menu shows its content pages
// (each at /<prefix>/<slug>) in its place.
async function expandDetailItems(projectId, items) {
  const pageIds = items.map((i) => i.page_id).filter(Boolean);
  if (!projectId || !pageIds.length) return items;
  const hits = await prisma.detailPageEntry.findMany({
    where: { project_id: projectId, detail_page_id: { in: pageIds } },
    select: { type_key: true, detail_page_id: true },
  });
  if (!hits.length) return items;
  const typeByPage = new Map(hits.map((h) => [h.detail_page_id, h.type_key]));
  const out = [];
  for (const item of items) {
    const typeKey = typeByPage.get(item.page_id);
    if (!typeKey) {
      out.push(item);
      continue;
    }
    const type = await prisma.detailPageType.findUnique({
      where: { project_id_type_key: { project_id: projectId, type_key: typeKey } },
    });
    const entries = await prisma.detailPageEntry.findMany({
      where: { project_id: projectId, type_key: typeKey, is_active: true, NOT: { detail_page_id: null } },
      orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
    });
    entries.forEach((e, n) =>
      out.push({
        ...item,
        id: `${item.id}:${e.id}`,
        label: e.title,
        page_id: e.detail_page_id,
        url: `/${type.slug_prefix}/${e.slug}`,
        order: item.order + (n + 1) / 1000,
      })
    );
  }
  return out;
}

// A link to a page that is no longer live (unpublished or deleted) must not reach visitors: it would 404.
// Applies to page links (page_id, or a stored /p/<slug>); headings, external links and the detail entries
// expanded above (their id holds ':') are left alone. Children of a dropped item go with it.
async function dropUnpublishedLinks(projectId, items) {
  const bySlug = (i) => (!i.page_id && i.url?.startsWith('/p/') ? i.url.slice(3) : null);
  const ids = [...new Set(items.filter((i) => i.page_id && !String(i.id).includes(':')).map((i) => i.page_id))];
  const slugs = [...new Set(items.map(bySlug).filter(Boolean))];
  if (!projectId || (!ids.length && !slugs.length)) return items;
  const pages = await prisma.builderPage.findMany({
    where: { project_id: projectId, OR: [...(ids.length ? [{ id: { in: ids } }] : []), ...(slugs.length ? [{ slug: { in: slugs } }] : [])] },
    select: { id: true, slug: true, status: true, deleted_at: true, template_id: true },
  });
  const dead = (p) => p.template_id == null && (p.deleted_at != null || p.status !== 'PUBLISHED');
  const deadIds = new Set(pages.filter(dead).map((p) => p.id));
  const deadSlugs = new Set(pages.filter(dead).map((p) => p.slug));
  const gone = new Set(
    items.filter((i) => !String(i.id).includes(':') && (deadIds.has(i.page_id) || deadSlugs.has(bySlug(i)))).map((i) => i.id)
  );
  if (!gone.size) return items;
  let grew = true;
  while (grew) {
    grew = false;
    for (const i of items) if (!gone.has(i.id) && i.parent_id && gone.has(i.parent_id)) (gone.add(i.id), (grew = true));
  }
  return items.filter((i) => !gone.has(i.id));
}

export const getPublicMenu = async (projectId, key) => {
  // Footer set to "same as header": serve the header menu under the footer key.
  if (key === 'footer' && (await getFooterSameAsHeader(prisma))) key = 'header';
  const where = { key };
  if (projectId) where.project_id = projectId;
  const menu = await prisma.menu.findFirst({
    where,
    include: { items: { where: { is_active: true } } },
  });
  if (!menu) return null;
  const live = await dropUnpublishedLinks(menu.project_id, await expandDetailItems(menu.project_id, menu.items));
  return { ...menu, items: buildTree(await withCleanUrls(menu.project_id, live)) };
};

export const ensureMenu = async ({ project_id, key, name }) => {
  // A menu always belongs to a project (T04b): none named means the default project.
  const projectId = project_id ?? (await getDefaultProjectId());
  if (!projectId) throw Object.assign(new Error('No project found to create the menu in'), { status: 409 });
  const menu = await prisma.menu.upsert({
    where: { project_id_key: { project_id: projectId, key } },
    create: { project_id: projectId, key, name },
    update: {},
    include: { items: true },
  });
  return { ...menu, items: buildTree(menu.items) };
};

export const updateMenu = async (id, data) => {
  const { count } = await prisma.menu.updateMany({ where: { id }, data });
  if (count === 0) return null;
  touchMenu(id);
  return getMenuById(id);
};

export const deleteMenu = async (id) => {
  const project_id = (await prisma.menu.findUnique({ where: { id }, select: { project_id: true } }))?.project_id;
  const { count } = await prisma.menu.deleteMany({ where: { id } });
  enqueueSiteBuild(project_id);
  return count > 0;
};

export const menuExists = (id) => prisma.menu.findUnique({ where: { id }, select: { id: true } });

// Walks real parent rows in the DB — used by createMenuItem, which (unlike
// reorderMenuItems) doesn't already have the whole tree in hand to check
// depth against a batch array.
const depthOfParentChain = async (parentId, seen = new Set()) => {
  if (!parentId) return 0;
  if (seen.has(parentId)) {
    throw Object.assign(new Error('Cycle detected in menu items'), { status: 422 });
  }
  seen.add(parentId);
  const parent = await prisma.menuItem.findUnique({
    where: { id: parentId },
    select: { parent_id: true },
  });
  if (!parent) return 0;
  return 1 + (await depthOfParentChain(parent.parent_id, seen));
};

const unprocessable = (message) => Object.assign(new Error(message), { status: 422 });

// A "<X> Detail" label is a detail TYPE: shared layout + two sample pages at /<x>/page1, /<x>/page2.
// Returns { pageId, url } for the menu item, or null to fall back to a plain scaffolded page
// (code-registered types like work/sectors, reserved or taken prefixes).
async function detailTypeForLabel(projectId, label, actorId) {
  if (!/\sdetail$/i.test(label.trim())) return null;
  const typeKey = slugify(label.trim().replace(/\s+detail$/i, ''));
  if (!typeKey || getDetailPageType(typeKey)) return null;
  const where = { project_id_type_key: { project_id: projectId, type_key: typeKey } };
  try {
    const type = (await prisma.detailPageType.findUnique({ where })) ?? (await createType(projectId, { name: label.trim() }, actorId));
    const first = await prisma.detailPageEntry.findFirst({
      where: { project_id: projectId, type_key: typeKey },
      orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
    });
    return first?.detail_page_id ? { pageId: first.detail_page_id, url: `/${type.slug_prefix}/${first.slug}` } : null;
  } catch {
    return null;
  }
}

// A detail type made outside the menu (Layout settings "Add detail page type") still gets its
// header menu item, so menus and layouts stay one-to-one.
export async function addDetailTypeToHeaderMenu(projectId, type) {
  const first = await prisma.detailPageEntry.findFirst({
    where: { project_id: projectId, type_key: type.type_key },
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
  if (!first?.detail_page_id) return;
  const menu = await prisma.menu.upsert({
    where: { project_id_key: { project_id: projectId, key: 'header' } },
    create: { project_id: projectId, key: 'header', name: 'Header Navigation' },
    update: {},
  });
  const last = await prisma.menuItem.findFirst({ where: { menu_id: menu.id, parent_id: null }, orderBy: { order: 'desc' }, select: { order: true } });
  await prisma.menuItem.create({
    data: {
      menu_id: menu.id,
      label: type.label,
      link_type: 'page',
      page_id: first.detail_page_id,
      url: `/${type.slug_prefix}/${first.slug}`,
      order: (last?.order ?? -1) + 1,
    },
  });
  touchMenu(menu.id);
}

export const createMenuItem = async (menuId, data, actorId = null) => {
  if (data.parent_id) {
    // The parent must be an item of THIS menu — never another menu's (or a dangling id).
    const parent = await prisma.menuItem.findUnique({
      where: { id: data.parent_id },
      select: { menu_id: true },
    });
    if (!parent || parent.menu_id !== menuId) throw unprocessable('Parent item must belong to this menu');
    const parentDepth = await depthOfParentChain(data.parent_id);
    if (parentDepth + 1 > MAX_DEPTH) {
      throw Object.assign(
        new Error(`Menu items can only nest ${MAX_DEPTH} levels deep`),
        { status: 422 }
      );
    }
  }
  let item = await prisma.menuItem.create({ data: { ...data, menu_id: menuId } });
  // A label-only item is "a page called X" — give it a real page (the Navigation wizard's contract).
  if (data.link_type === 'custom' && !data.url && !data.page_id && !data.no_page) {
    const menu = await prisma.menu.findUnique({ where: { id: menuId }, select: { project_id: true } });
    if (menu?.project_id) {
      const detail = await detailTypeForLabel(menu.project_id, data.label, actorId);
      const page = detail ? null : await scaffoldPageForLabel(menu.project_id, data.label, actorId);
      item = await prisma.menuItem.update({
        where: { id: item.id },
        data: { page_id: detail?.pageId ?? page.id, url: detail?.url ?? `/p/${page.slug}`, link_type: 'page' },
      });
    }
  }
  touchMenu(menuId);
  return item;
};

export const getMenuItemById = (id) => prisma.menuItem.findUnique({ where: { id } });

// Renaming a detail menu item renames the layout/pages behind it (type label for DB types,
// page titles for plain "X Detail" nav pages). URLs and keys never change.
async function syncDetailRename(before, label) {
  if (!before?.page_id || !label || label === before.label) return;
  const menu = await prisma.menu.findUnique({ where: { id: before.menu_id }, select: { project_id: true } });
  const projectId = menu?.project_id;
  if (!projectId) return;
  const entry = await prisma.detailPageEntry.findFirst({ where: { detail_page_id: before.page_id, project_id: projectId } });
  if (entry) {
    await prisma.detailPageType.update({
      where: { project_id_type_key: { project_id: projectId, type_key: entry.type_key } },
      data: { label },
    });
    return;
  }
  const page = await prisma.builderPage.findFirst({ where: { id: before.page_id, project_id: projectId, deleted_at: null } });
  if (!page || !/\sdetail$/i.test(page.title.trim()) || !/\sdetail$/i.test(label.trim())) return;
  await prisma.builderPage.updateMany({ where: { project_id: projectId, title: page.title, deleted_at: null }, data: { title: label } });
  await renameInWebsiteStage(projectId, page.title, label);
}

export const updateMenuItem = async (id, data) => {
  await syncDetailRename(await getMenuItemById(id), data.label).catch(() => {});
  const { count } = await prisma.menuItem.updateMany({ where: { id }, data });
  if (count === 0) return null;
  const item = await getMenuItemById(id);
  touchMenu(item.menu_id);
  return item;
};

// Deleting a "<X> Detail" menu item deletes the whole detail group behind it — a DB type
// (layout + every entry page) or every same-titled nav page — so no pill/page is orphaned.
async function cascadeDetailDelete(item, actorId) {
  if (!item?.page_id) return;
  const menu = await prisma.menu.findUnique({ where: { id: item.menu_id }, select: { project_id: true } });
  const projectId = menu?.project_id;
  if (!projectId) return;
  const entry = await prisma.detailPageEntry.findFirst({ where: { detail_page_id: item.page_id, project_id: projectId } });
  if (entry) {
    await deleteType(projectId, entry.type_key, actorId);
    return;
  }
  const page = await prisma.builderPage.findFirst({ where: { id: item.page_id, project_id: projectId, deleted_at: null } });
  if (!page || !/\sdetail$/i.test(page.title.trim())) return;
  const group = await prisma.builderPage.findMany({
    where: { project_id: projectId, title: page.title, deleted_at: null },
    select: { id: true },
  });
  for (const p of group) await deletePage(p.id, actorId).catch(() => {});
}

export const deleteMenuItem = async (id, actorId = null) => {
  const found = await getMenuItemById(id);
  const menuId = found?.menu_id;
  await cascadeDetailDelete(found, actorId).catch(() => {});
  const { count } = await prisma.menuItem.deleteMany({ where: { id } });
  touchMenu(menuId);
  // The cascade may already have removed this very row (its page was deleted) — still a success.
  return count > 0 || Boolean(found);
};

// Validates the incoming flat item list doesn't nest past MAX_DEPTH before
// writing anything — a client bug (or a future 4th-level drag the UI should
// have refused) fails the whole request instead of silently corrupting the
// tree.
export function validateDepth(items) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const depthOf = (id, seen = new Set()) => {
    if (seen.has(id)) throw Object.assign(new Error('Cycle detected in menu items'), { status: 422 });
    seen.add(id);
    const item = byId.get(id);
    if (!item || !item.parent_id) return 1;
    if (!byId.has(item.parent_id)) return 1; // parent outside this batch — treat as root here
    return 1 + depthOf(item.parent_id, seen);
  };
  for (const item of items) {
    if (depthOf(item.id) > MAX_DEPTH) {
      throw Object.assign(
        new Error(`Menu items can only nest ${MAX_DEPTH} levels deep`),
        { status: 422 }
      );
    }
  }
}

export const reorderMenuItems = async (menuId, items) => {
  // Only this menu's own items may be moved, and only under this menu's own items.
  // (The route authorises "edit menus" for the menu in the URL; without this a
  // caller could re-parent items belonging to any other menu/project.)
  const existing = await prisma.menuItem.findMany({
    where: { menu_id: menuId },
    select: { id: true, parent_id: true },
  });
  const ownIds = new Set(existing.map((i) => i.id));
  for (const item of items) {
    if (!ownIds.has(item.id) || (item.parent_id && !ownIds.has(item.parent_id))) {
      throw unprocessable('Items and parents must belong to this menu');
    }
  }
  // Depth is checked on the whole resulting tree (stored items overlaid with the
  // batch), so a parent that sits outside the batch still counts toward the limit.
  const merged = new Map(existing.map((i) => [i.id, { id: i.id, parent_id: i.parent_id }]));
  for (const item of items) merged.set(item.id, { id: item.id, parent_id: item.parent_id });
  validateDepth([...merged.values()]);
  await prisma.$transaction(
    items.map((item) =>
      prisma.menuItem.update({
        where: { id: item.id },
        data: { parent_id: item.parent_id, order: item.order },
      })
    )
  );
  touchMenu(menuId);
  return getMenuById(menuId);
};

export const getMenuOptions = async () => ({ footer_same_as_header: await getFooterSameAsHeader(prisma) });

export const updateMenuOptions = async ({ footer_same_as_header }) => {
  if (footer_same_as_header !== undefined) await setFooterSameAsHeader(prisma, footer_same_as_header);
  enqueueSiteBuild();
  return getMenuOptions();
};
