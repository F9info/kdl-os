import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

// Demo header + footer navigation for the default project. Pages are the
// DemoLogo site pages created by scripts/seed-demo-site.js (`/p/<prefix>-<key>`).
export const DEMO_PAGE_PREFIX = 'demo';
const page = (key) => `/p/${DEMO_PAGE_PREFIX}-${key}`;

const ITEMS = [
  { label: 'Home', url: page('home') },
  { label: 'About', url: page('about') },
  { label: 'Services', url: page('services') },
  { label: 'Portfolio', url: page('portfolio') },
  { label: 'Blog', url: page('blog') },
  { label: 'Contact', url: page('contact') },
];

const MENUS = [
  { key: 'header', name: 'Header Navigation' },
  { key: 'footer', name: 'Footer Navigation' },
];

export async function seedMenus(prismaClient = prisma) {
  const projectId = await getDefaultProjectId(prismaClient);
  if (!projectId) return;
  for (const def of MENUS) {
    const menu = await prismaClient.menu.upsert({
      where: { project_id_key: { project_id: projectId, key: def.key } },
      create: { project_id: projectId, key: def.key, name: def.name },
      update: {},
    });
    for (let i = 0; i < ITEMS.length; i++) {
      const existing = await prismaClient.menuItem.findFirst({
        where: { menu_id: menu.id, label: ITEMS[i].label, parent_id: null },
        select: { id: true },
      });
      if (existing) continue;
      await prismaClient.menuItem.create({
        data: { menu_id: menu.id, label: ITEMS[i].label, link_type: 'custom', url: ITEMS[i].url, order: i },
      });
    }
  }
  console.log('menus.seed: seeded demo header + footer menus');
}
