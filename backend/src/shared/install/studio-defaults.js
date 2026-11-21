// The Studio steps a person does by hand for a website (docs/flows/04-webapp-admin.md steps 5-11), done
// once with the screens' own defaults, so Frontend > Brands, Color Palette, Navigation, Layouts and Pages
// work right after the installer. Without it a new server had no Studio run and every one of those
// screens failed. Everything stays editable afterwards.
//
// The backend's stage order is stricter than the screens show: INTAKE -> PALETTE -> INFERENCE -> APPROVAL
// -> WEBSITE (inference and approval are hidden in the simplified Studio but still required).
// Safe to run again: finished stages are skipped and an existing run is reused.
import { prisma } from '../../config/database.js';
import { getDefaultProjectId } from '../default-project.js';

// The screens' defaults (WebsiteStage.tsx fonts, website-layout-overrides.ts layout, the website driver's
// menu pages plus Services).
export const STUDIO_NAV_PAGES = ['Home', 'About', 'Services', 'Contact'];
export const STUDIO_TYPOGRAPHY = {
  heading: { family: 'Poppins', families: ['Poppins'] },
  body: { family: 'Inter', families: ['Inter'] },
};
export const STUDIO_LAYOUT = {
  topHeader: { enabled: true, variant: '5' },
  header: { enabled: true, variant: '5' },
  footer: { enabled: true, variant: '5' },
};

const fail = (message, code) => Object.assign(new Error(message), { code });

async function superAdminId() {
  const row = await prisma.userRole.findFirst({
    where: { role: { slug: 'super-admin' }, user: { deleted_at: null } },
    select: { user_id: true },
  });
  return row?.user_id ?? null;
}

// The palette is read from the logo, which production only allows once the upload passed a virus scan.
async function waitForLogoScan(projectId, { timeoutMs, pollMs, getKit, getUploadSettings }) {
  const { requireScan } = await getUploadSettings();
  if (!requireScan) return;
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const kit = await getKit(projectId);
    const mediaId = kit?.logo_raster_media_id ?? kit?.logo_media_id;
    if (!mediaId) throw fail('The brand kit has no logo (the Identity logo could not be read as an image)', 'NO_LOGO');
    const media = mediaId ? await prisma.media.findUnique({ where: { id: mediaId }, select: { scan_result: true } }) : null;
    if (media?.scan_result === 'CLEAN') return;
    if (media?.scan_result && media.scan_result !== 'CLEAN' && media.scan_result !== 'PENDING') {
      throw fail(`Logo scan result is ${media.scan_result} (is the virus scanner running? CLAMAV_HOST)`, 'LOGO_SCAN_NOT_CLEAN');
    }
    if (Date.now() >= deadline) throw fail('Logo virus scan did not finish in time', 'LOGO_SCAN_TIMEOUT');
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * Runs the Studio with defaults for the default project. Returns { status, runId, steps }.
 * deps are injectable for tests; production uses the real services (imported on demand so the
 * installer's other routes never load them).
 */
export async function completeStudioDefaults({ actorId = null, log = () => {}, timeoutMs = 180000, pollMs = 3000, deps } = {}) {
  const d = deps ?? {
    ...(await import('../../modules/template-engine/service.js')),
    ...(await import('../../modules/brand-kit/service.js')),
    ...(await import('../../modules/media/settings.js')),
    ...(await import('../../modules/projects/layout.js')),
    ...(await import('../../modules/menus/site-menus.js')),
  };
  const steps = [];
  const projectId = await getDefaultProjectId(prisma);
  if (!projectId) return { status: 'skipped', reason: 'no default project', steps };
  const actor = actorId ?? (await superAdminId());
  if (!actor) return { status: 'skipped', reason: 'no Super Admin user', steps };

  const runs = await d.listRuns(projectId);
  let run = runs[0] ?? null;
  const stageDone = (r, stage) => r.stages.some((s) => s.stage === stage && (s.status === 'DONE' || s.status === 'SKIPPED'));
  if (run && stageDone(run, 'WEBSITE')) return { status: 'already-done', runId: run.id, steps };
  if (!run) {
    run = await d.createRun(projectId, actor);
    steps.push('run');
  }
  const advance = async (slug, stage, options) => {
    const current = await d.getRun(run.id, projectId);
    if (stageDone(current, stage)) return;
    await d.advanceStage(run.id, slug, actor, projectId, options);
    steps.push(slug);
    log(`studio: ${slug} done`);
  };

  await advance('intake', 'INTAKE'); // adopts the Identity logo into the brand kit
  await waitForLogoScan(projectId, { timeoutMs, pollMs, getKit: d.getKit, getUploadSettings: d.getUploadSettings });
  await advance('palette', 'PALETTE'); // four colours from the logo's pixels (no AI)
  await advance('inference', 'INFERENCE'); // rule-based fallback when no AI service answers

  let kit = await d.getKit(projectId);
  if (kit.status !== 'approved') {
    // Inference sets Inter/Inter; the Website screen's default is Poppins headings. Must precede approval.
    await d.patchKit(projectId, { typography: STUDIO_TYPOGRAPHY });
    kit = await d.getKit(projectId);
    const acknowledgedAdjustmentIds = (kit.contrast_report?.adjustments ?? []).map((a) => a.id);
    await d.approveKit(projectId, { acknowledgedAdjustmentIds });
    steps.push('approve-kit');
  }
  await advance('approval', 'APPROVAL'); // writes the brand colours into the theme

  if (!(await d.getSiteLayout(projectId))) {
    await d.saveSiteLayout(projectId, STUDIO_LAYOUT);
    steps.push('layout');
  }
  // With sample content the starter site already has Home, About, Services and Contact. The website
  // stage reuses pages listed in its outputRef.pageKeyToId (its crash-recovery map) and only restyles
  // them, so list the starter pages there: otherwise Frontend > Pages shows each of them twice.
  const reuse = {};
  for (const title of STUDIO_NAV_PAGES) {
    const key = title.toLowerCase();
    const page = await prisma.builderPage.findFirst({
      where: { project_id: projectId, route_key: key, deleted_at: null, NOT: { slug: { startsWith: 'te-' } } },
      select: { id: true },
    });
    if (page) reuse[key] = page.id;
  }
  const current = await d.getRun(run.id, projectId);
  if (Object.keys(reuse).length > 0 && !stageDone(current, 'WEBSITE')) {
    const outputRef = { pageKeyToId: reuse };
    await prisma.templateEngineStage.upsert({
      where: { runId_stage: { runId: run.id, stage: 'WEBSITE' } },
      create: { runId: run.id, stage: 'WEBSITE', status: 'PENDING', outputRef },
      update: { outputRef },
    });
  }
  await advance('website', 'WEBSITE', { navigationPages: STUDIO_NAV_PAGES });

  // Navigation: link the menu pages, unless the menus already have links (e.g. the sample-content site).
  const done = await d.getRun(run.id, projectId);
  const out = done.stages.find((s) => s.stage === 'WEBSITE')?.outputRef ?? {};
  const header = await prisma.menu.findFirst({ where: { project_id: projectId, key: 'header' }, select: { id: true } });
  const headerLinks = header ? await prisma.menuItem.count({ where: { menu_id: header.id } }) : 0;
  if (headerLinks === 0) {
    for (const title of STUDIO_NAV_PAGES) {
      const key = Object.keys(out.pageKeyToTitle ?? {}).find((k) => out.pageKeyToTitle[k] === title);
      const pageId = key && out.pageKeyToId?.[key];
      if (!pageId) continue;
      const page = await prisma.builderPage.findUnique({ where: { id: pageId }, select: { id: true, slug: true, title: true } });
      if (page) await d.addPageToMenus(prisma, { projectId, page });
    }
    steps.push('menus');
  }
  return { status: 'done', runId: run.id, steps };
}
