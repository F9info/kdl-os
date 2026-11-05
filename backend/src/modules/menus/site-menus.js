// Keeps the website's Header and Footer menus in step with its pages.
// Every function takes a Prisma client (or transaction) so installs can call them inside a tx.

const HEADER = { key: 'header', name: 'Header Navigation' };
const FOOTER = { key: 'footer', name: 'Footer Navigation' };

async function ensureMenu(client, projectId, { key, name }) {
  return client.menu.upsert({
    where: { project_id_key: { project_id: projectId, key } },
    create: { project_id: projectId, key, name },
    update: {},
  });
}

// Adds a page as a top-level link at the end of the header and/or footer menu.
// Only called for a NEW page: a link the user later removes or moves is never put back.
export async function addPageToMenus(client, { projectId, page, header = true, footer = true }) {
  const targets = [header && HEADER, footer && FOOTER].filter(Boolean);
  const added = [];
  for (const target of targets) {
    const menu = await ensureMenu(client, projectId, target);
    const url = `/p/${page.slug}`;
    const exists = await client.menuItem.findFirst({
      where: { menu_id: menu.id, OR: [{ page_id: page.id }, { url }] },
      select: { id: true },
    });
    if (exists) continue;
    const last = await client.menuItem.findFirst({
      where: { menu_id: menu.id, parent_id: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    await client.menuItem.create({
      data: {
        menu_id: menu.id,
        label: page.title,
        link_type: 'page',
        page_id: page.id,
        url,
        order: (last?.order ?? -1) + 1,
      },
    });
    added.push(target.key);
  }
  return added;
}

// A deleted page must not leave a dead link. Its sub-items move up one level (they are not deleted).
export async function removePageFromMenus(client, page) {
  const items = await client.menuItem.findMany({
    where: { OR: [{ page_id: page.id }, { url: `/p/${page.slug}` }] },
    select: { id: true, parent_id: true },
  });
  for (const item of items) {
    await client.menuItem.updateMany({
      where: { parent_id: item.id },
      data: { parent_id: item.parent_id },
    });
    await client.menuItem.deleteMany({ where: { id: item.id } });
  }
  return items.length;
}

// "Footer uses the same links as the header" (default: off — the footer has its own list).
export const FOOTER_SAME_KEY = 'menus.footer_same_as_header';

export async function getFooterSameAsHeader(client) {
  const row = await client.appSetting.findUnique({ where: { key: FOOTER_SAME_KEY } });
  return row?.value === 'true';
}

export async function setFooterSameAsHeader(client, on) {
  const value = on ? 'true' : 'false';
  await client.appSetting.upsert({
    where: { key: FOOTER_SAME_KEY },
    update: { value },
    create: { key: FOOTER_SAME_KEY, value, description: 'Footer menu mirrors the header menu' },
  });
  return on;
}
