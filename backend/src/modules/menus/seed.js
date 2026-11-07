import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';

// Header and footer menus for the default project, created empty. Links are added as pages are created
// (site-menus.js addPageToMenus). This seed used to add six links to /p/demo-home, /p/demo-about ... which only
// exist if scripts/seed-demo-site.js was run: on every other install they were dead links.
export const DEMO_PAGE_PREFIX = 'demo'; // still used by scripts/seed-demo-site.js

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
    void menu;
  }
  console.log('menus.seed: ensured header + footer menus');
}
