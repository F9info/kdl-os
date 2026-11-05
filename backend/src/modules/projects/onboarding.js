import { prisma } from '../../config/database.js';
import { getPageBySlug } from '../page-builder/service.js';
import {
  STARTER_PAGES,
  HEADER_SLUGS,
  buildStarterPage,
  insertPublishedPage,
} from './starter-site.js';
import { cmsPages, cmsEnabled, applyCmsSite } from '../cms/pages.js';
import { addPageToMenus } from '../menus/site-menus.js';

export { STARTER_PAGES };
export const buildPageData = (slug, title, pages = STARTER_PAGES) =>
  buildStarterPage(slug, title, pages);

// First-run question: "Do you need a front-end website?"
// Answer lives in app_settings (absent = not answered yet, so the pop-up keeps showing).
export const ONBOARDING_KEY = 'onboarding.frontend';

export async function getOnboarding() {
  const row = await prisma.appSetting.findUnique({ where: { key: ONBOARDING_KEY } });
  return { answered: !!row, choice: row ? row.value : null };
}

const saveChoice = (value) =>
  prisma.appSetting.upsert({
    where: { key: ONBOARDING_KEY },
    update: { value },
    create: {
      key: ONBOARDING_KEY,
      value,
      description: 'First-run answer: front-end website needed (yes/no)',
    },
  });

export async function answerOnboarding(choice, actorId) {
  if (choice === 'no') {
    await saveChoice('no');
    return { choice, created: [], skipped: [] };
  }
  const project = await prisma.project.findFirst({ where: { is_default: true, deleted_at: null } });
  if (!project)
    throw Object.assign(new Error('Default project not found — run the seed first'), {
      status: 409,
    });

  const created = [];
  const skipped = [];
  // With CMS installed the nav already lists the CMS pages (Gallery, ...).
  const withCms = await cmsEnabled(prisma);
  const navPages = [...STARTER_PAGES, ...(withCms ? cmsPages() : [])];
  for (const { slug, title } of STARTER_PAGES) {
    // Safe to click twice: an existing slug (even soft-deleted) is never recreated.
    if (await getPageBySlug(slug)) {
      skipped.push(slug);
      continue;
    }
    const page = await insertPublishedPage(prisma, {
      slug,
      title,
      data: buildPageData(slug, title, navPages),
      projectId: project.id,
      actorId,
    });
    await addPageToMenus(prisma, {
      projectId: project.id,
      page,
      header: HEADER_SLUGS.includes(slug),
    });
    created.push(slug);
  }
  if (withCms) created.push(...(await applyCmsSite(prisma, { answered: true, actorId })).created);
  // Saved last: if anything above threw, the pop-up shows again and a retry fills the gaps.
  await saveChoice('yes');
  return { choice, created, skipped };
}
