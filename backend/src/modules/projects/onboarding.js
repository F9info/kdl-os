import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import {
  STARTER_PAGES,
  HEADER_SLUGS,
  brandName,
  buildStarterPage,
  insertPublishedPage,
} from './starter-site.js';
import { cmsPages, cmsEnabled, applyCmsSite, seedCmsSamples } from '../cms/pages.js';
import { addPageToMenus } from '../menus/site-menus.js';

export { STARTER_PAGES };
export const buildPageData = (slug, title, pages = STARTER_PAGES, brand) =>
  buildStarterPage(slug, title, pages, brand);

// First-run question: "Do you need a front-end website?"
// Answer lives in app_settings (absent = not answered yet, so the pop-up keeps showing).
export const ONBOARDING_KEY = 'onboarding.frontend';

export async function getOnboarding() {
  const row = await prisma.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
  return { answered: !!row, choice: row ? row.value : null };
}

export const saveChoice = (value, client = prisma) =>
  client.appSetting.upsert({
    where: { key: ONBOARDING_KEY },
    update: { value },
    create: {
      key: ONBOARDING_KEY,
      value,
      description: 'First-run answer: front-end website needed (yes/no)',
    },
  });

/**
 * Creates the starter website (Home, About, Services, Contact, FAQ, plus the CMS pages when CMS is
 * on) and links it from the menus. The company name comes from Application Identity, so nothing is
 * asked twice. `withCms` forces the CMS pages in or out (the CMS install seed runs before the
 * module is marked enabled). Safe to run again: a slug that exists (even soft-deleted) is never recreated.
 * `client` is a Prisma client or a transaction.
 */
export async function createStarterSite(client, actorId = null, { withCms } = {}) {
  const projectId = await getDefaultProjectId(client);
  if (!projectId)
    throw Object.assign(new Error('Default project not found — run the seed first'), {
      status: 409,
    });

  const created = [];
  const skipped = [];
  const brand = await brandName(client);
  // With CMS installed the nav already lists the CMS pages (Gallery, ...).
  const includeCms = withCms ?? (await cmsEnabled(client));
  const navPages = [...STARTER_PAGES, ...(includeCms ? cmsPages() : [])];
  for (const { slug, title } of STARTER_PAGES) {
    if (await client.builderPage.findFirst({ where: { slug, project_id: projectId } })) {
      skipped.push(slug);
      continue;
    }
    const page = await insertPublishedPage(client, {
      slug,
      title,
      data: buildPageData(slug, title, navPages, brand),
      projectId,
      actorId,
    });
    await addPageToMenus(client, {
      projectId,
      page,
      header: HEADER_SLUGS.includes(slug),
    });
    created.push(slug);
  }
  if (includeCms) created.push(...(await applyCmsSite(client, { answered: true, actorId })).created);
  return { created, skipped };
}

export async function answerOnboarding(choice, actorId) {
  if (choice === 'no') {
    await saveChoice('no');
    return { choice, created: [], skipped: [] };
  }
  const { created, skipped } = await createStarterSite(prisma, actorId);
  // "Sample website" also means the sample content its CMS pages show (FAQ, team, gallery ...), but
  // only when CMS is installed. Without this the sample pages would render empty lists.
  if (await cmsEnabled(prisma)) await seedCmsSamples(prisma);
  // Saved last: if anything above threw, the pop-up shows again and a retry fills the gaps.
  await saveChoice('yes');
  return { choice, created, skipped };
}
