import { prisma } from '../../config/database.js';
import { enqueueSiteBuild } from '../template-engine/site/queue.js';

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
export const getPublicMenu = async (projectId, key) => {
  const where = { key };
  if (projectId) where.project_id = projectId;
  const menu = await prisma.menu.findFirst({
    where,
    include: { items: { where: { is_active: true } } },
  });
  if (!menu) return null;
  return { ...menu, items: buildTree(menu.items) };
};

export const ensureMenu = async ({ project_id, key, name }) => {
  const menu = await prisma.menu.upsert({
    where: { project_id_key: { project_id: project_id ?? null, key } },
    create: { project_id: project_id ?? null, key, name },
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

export const createMenuItem = async (menuId, data) => {
  if (data.parent_id) {
    const parentDepth = await depthOfParentChain(data.parent_id);
    if (parentDepth + 1 > MAX_DEPTH) {
      throw Object.assign(
        new Error(`Menu items can only nest ${MAX_DEPTH} levels deep`),
        { status: 422 }
      );
    }
  }
  const item = await prisma.menuItem.create({ data: { ...data, menu_id: menuId } });
  touchMenu(menuId);
  return item;
};

export const getMenuItemById = (id) => prisma.menuItem.findUnique({ where: { id } });

export const updateMenuItem = async (id, data) => {
  const { count } = await prisma.menuItem.updateMany({ where: { id }, data });
  if (count === 0) return null;
  const item = await getMenuItemById(id);
  touchMenu(item.menu_id);
  return item;
};

export const deleteMenuItem = async (id) => {
  const menuId = (await getMenuItemById(id))?.menu_id;
  const { count } = await prisma.menuItem.deleteMany({ where: { id } });
  touchMenu(menuId);
  return count > 0;
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
  validateDepth(items);
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
