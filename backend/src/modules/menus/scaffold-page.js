import { prisma } from '../../config/database.js';
import { createPage, updatePage } from '../page-builder/service.js';
import { slugify } from '../../shared/utils/slug.js';

const CHROME = ['ConstructionTopBar', 'ConstructionHeader', 'ConstructionFooter'];
const MAX_SLUG_TRIES = 50;

// The project's own page that already carries the site chrome (top bar / header / footer).
async function findDonorContent(projectId) {
  const pages = await prisma.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null },
    orderBy: { created_at: 'asc' },
    select: { data: true },
  });
  return pages.map((p) => p.data?.content ?? []).find((c) => c.some((b) => b.type === 'ConstructionHeader'));
}

async function uniqueSlug(label, projectId) {
  const base = `page-${slugify(label) || 'page'}`;
  for (let n = 1; n <= MAX_SLUG_TRIES; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await prisma.builderPage.findFirst({ where: { slug, project_id: projectId }, select: { id: true } }))) return slug;
  }
  throw Object.assign(new Error('Could not find a free page slug'), { status: 409 });
}

// Adds the new page to the latest WEBSITE stage output so the Pages view lists it.
async function registerInWebsiteStage(projectId, baseKey, page) {
  let key = baseKey;
  const run = await prisma.templateEngineRun.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const stage = run && (await prisma.templateEngineStage.findFirst({ where: { runId: run.id, stage: 'WEBSITE' } }));
  if (!stage) return;
  const out = stage.outputRef ?? {};
  // Two pages can share a title ("Service Detail"): same `-2`, `-3` key convention as the website driver.
  const taken = out.pageKeyToId ?? {};
  let unique = key;
  for (let n = 2; unique in taken && n < 1000; n += 1) unique = `${key}-${n}`;
  key = unique;
  await prisma.templateEngineStage.update({
    where: { id: stage.id },
    data: {
      outputRef: {
        ...out,
        pageIds: [...(out.pageIds ?? []), page.id],
        pageKeyToId: { ...(out.pageKeyToId ?? {}), [key]: page.id },
        pageKeyToTitle: { ...(out.pageKeyToTitle ?? {}), [key]: page.title },
      },
    },
  });
}

/**
 * A label-only menu item is "a page called X": create it (site chrome + a title banner),
 * publish it, and list it in the Pages view. Returns the page, or null if nothing was made.
 */
export async function scaffoldPageForLabel(projectId, label, actorId) {
  const slug = await uniqueSlug(label, projectId);
  const donor = (await findDonorContent(projectId)) ?? [];
  const banner = donor.find((b) => b.type === 'ConstructionInnerBanner');
  const content = [];
  for (const type of CHROME) {
    const b = donor.find((x) => x.type === type);
    if (!b) continue;
    if (type === 'ConstructionFooter' && banner) {
      content.push({ ...banner, props: { ...banner.props, id: `${slug}-banner`, headline: label, currentLabel: label, subtitle: '', parentLabel: '', parentHref: '', ctaPrimaryLabel: '', ctaPrimaryHref: '', ctaSecondaryLabel: '', ctaSecondaryHref: '' } });
    }
    content.push({ ...b, props: { ...b.props, id: `${slug}-${type}` } });
  }
  const created = await createPage({ title: label, slug, data: { root: { props: { title: label } }, content, zones: {} }, project_id: projectId }, actorId);
  const page = await updatePage(created.id, { status: 'PUBLISHED' }, actorId);
  await registerInWebsiteStage(projectId, slugify(label) || 'page', page);
  return page;
}
