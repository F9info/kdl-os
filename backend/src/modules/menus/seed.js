import { prisma } from '../../config/database.js';

// Real Subhadra Group header navigation, previously a flat "Label|href"
// string baked into ConstructionHeader's own `links` prop — moved here as
// the single source of truth. Attached to the specific Subhadra project
// already running in this environment (this module has no generic demo
// data of its own beyond this one client).
//
// Flat on purpose — the real reference site (after-delete-folder/*.html)
// has no dropdown/submenu anywhere in its header; this seed exercises the
// Menu/MenuItem model at depth 1 only. The 3-level hierarchy the model
// supports has no real Subhadra content to seed it with yet.
const SUBHADRA_PROJECT_ID = 'cmt15bmts000401s6fn5ydhzp';
const HOME_SLUG = 'te-cmt18teqh000101rxwfzfndow-home';

const HEADER_ITEMS = [
  { label: 'Home', url: `/p/${HOME_SLUG}` },
  { label: 'Products & Services', url: `/p/te-cmt18teqh000101rxwfzfndow-products-services` },
  { label: 'Sectors', url: `/p/te-cmt18teqh000101rxwfzfndow-sectors` },
  { label: 'Contact', url: `/p/te-cmt18teqh000101rxwfzfndow-contact` },
  { label: 'About', url: `/p/te-cmt18teqh000101rxwfzfndow-about` },
];

export async function seedMenus(prismaClient = prisma) {
  const menu = await prismaClient.menu.upsert({
    where: { project_id_key: { project_id: SUBHADRA_PROJECT_ID, key: 'header' } },
    create: { project_id: SUBHADRA_PROJECT_ID, key: 'header', name: 'Header Navigation' },
    update: {},
  });

  for (let i = 0; i < HEADER_ITEMS.length; i++) {
    const def = HEADER_ITEMS[i];
    const existing = await prismaClient.menuItem.findFirst({
      where: { menu_id: menu.id, label: def.label, parent_id: null },
      select: { id: true },
    });
    if (existing) continue;
    await prismaClient.menuItem.create({
      data: {
        menu_id: menu.id,
        label: def.label,
        link_type: 'custom',
        url: def.url,
        order: i,
      },
    });
  }

  console.log(`menus.seed: seeded "header" menu with ${HEADER_ITEMS.length} real Subhadra items`);
}
