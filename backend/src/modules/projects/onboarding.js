import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../../shared/default-project.js';
import {
  STARTER_PAGES,
  HEADER_SLUGS,
  brandName,
  contactDetails,
  buildStarterPage,
  insertPublishedPage,
} from './starter-site.js';
import { cmsPages, cmsEnabled, applyCmsSite, seedCmsSamples } from '../cms/pages.js';
import { addPageToMenus, removeDeadDemoLinks } from '../menus/site-menus.js';
import { ONBOARDING_KEY } from '../../shared/demo-content.js';
import { isInstalled } from '../../shared/install/status.js';

export { ONBOARDING_KEY };
import { seedFaq } from '../faq/seed.js';
import { seedTeam } from '../team/seed.js';
import { seedProjectsContent } from '../projects-content/seed.js';

export { STARTER_PAGES };
export const buildPageData = (slug, title, pages = STARTER_PAGES, brand, contact) =>
  buildStarterPage(slug, title, pages, brand, contact);

// First-run question: "Do you need a front-end website?"
// Answer lives in app_settings (absent = not answered yet, so the pop-up keeps showing).

export async function getOnboarding() {
  const row = await prisma.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
  // The first-run wizard (/install) already asked for company details and what to build, so the
  // post-login setup pop-up has nothing left to ask once it has finished.
  return { answered: !!row || (await isInstalled()), choice: row ? row.value : null };
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
  const contact = await contactDetails(client);
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
      data: buildPageData(slug, title, navPages, brand, contact),
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

// Sample rows of the content modules that are already installed. A module installed LATER seeds its own
// rows (its install seed checks the same answer), so nothing is missed and nothing is added twice.
const DEMO_SEEDS = { faq: seedFaq, team: seedTeam, 'projects-content': seedProjectsContent };
export async function seedInstalledDemoContent(client) {
  const seeded = [];
  for (const [slug, seed] of Object.entries(DEMO_SEEDS)) {
    const mod = await client.module.findUnique({ where: { slug } });
    if (mod?.status !== 'ENABLED') continue;
    await seed(client);
    seeded.push(slug);
  }
  return seeded;
}

export async function answerOnboarding(choice, actorId) {
  if (choice === 'no') {
    await saveChoice('no');
    await removeDeadDemoLinks(prisma);
    return { choice, created: [], skipped: [] };
  }
  const before = await getOnboarding();
  try {
    const { created, skipped } = await createStarterSite(prisma, actorId);
    // "Sample website" also means the sample content its CMS pages show (FAQ, team, gallery ...), but
    // only when CMS is installed. Without this the sample pages would render empty lists.
    if (await cmsEnabled(prisma)) await seedCmsSamples(prisma);
    // The answer must be stored before the module seeds run: they only add sample rows after a "yes".
    await saveChoice('yes');
    await seedInstalledDemoContent(prisma);
    await removeDeadDemoLinks(prisma);
    return { choice, created, skipped };
  } catch (err) {
    // If anything threw, put the answer back as it was: the pop-up shows again and a retry fills the gaps.
    if (before.answered) await saveChoice(before.choice);
    else await prisma.appSetting.deleteMany({ where: { key: ONBOARDING_KEY } });
    throw err;
  }
}

