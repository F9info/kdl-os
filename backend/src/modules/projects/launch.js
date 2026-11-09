// T13: project Launch. Checks every page that would go live, publishes them, and records when and by whom on
// the project (config.launch) and marks the project ACTIVE. "Would go live" = a draft page, or a published page
// with unpublished edits; a page that is already live and unchanged is left alone.
import { prisma } from '../../config/database.js';
import { checkPage, publish } from '../page-builder/service.js';

const pendingPages = (projectId, client) =>
  client.builderPage.findMany({
    where: { project_id: projectId, deleted_at: null, OR: [{ status: 'DRAFT' }, { draft_data: { not: null } }] },
    select: { id: true, slug: true, title: true, status: true },
    orderBy: { created_at: 'asc' },
  });

const httpError = (status, message, errors) => Object.assign(new Error(message), { status, errors });

/** What Launch would do: per page its problems, and whether the whole project is ready. */
export async function checkLaunch(projectId, client = prisma) {
  const project = await client.project.findFirst({ where: { id: projectId, deleted_at: null }, select: { id: true, config: true } });
  if (!project) throw httpError(404, 'Project not found');
  const pages = [];
  for (const p of await pendingPages(projectId, client)) {
    const r = await checkPage(p.id);
    pages.push({ ...p, errors: r.errors, warnings: r.warnings, can_publish: r.can_publish, issues: r.issues });
  }
  return { ready: pages.every((p) => p.can_publish), pages, launch: project.config?.launch ?? null };
}

/**
 * Publishes every pending page. Refuses (422, with the report) when any page has a blocking problem, unless
 * `force` is set. A page that fails while publishing is reported and does not stop the others; the launch is
 * recorded only when nothing failed.
 */
export async function launchProject(projectId, actorId, { force = false } = {}, client = prisma) {
  const report = await checkLaunch(projectId, client);
  if (!report.ready && !force) throw httpError(422, 'Some pages have problems to fix before launch.', { code: 'LAUNCH_NOT_READY', ...report });
  const published = [];
  const failed = [];
  for (const p of report.pages) {
    try {
      await publish(p.id, { force }, actorId);
      published.push(p.id);
    } catch (err) {
      failed.push({ id: p.id, slug: p.slug, message: err.message });
    }
  }
  if (failed.length) throw httpError(500, 'Some pages could not be published.', { code: 'LAUNCH_PARTIAL', published, failed });
  const launch = { at: new Date().toISOString(), by: actorId ?? null, published: published.length };
  // One statement so the other config keys are never rewritten from a stale copy (see workflow.js).
  await client.$executeRaw`
    UPDATE projects SET config = jsonb_set(config, '{launch}', ${JSON.stringify(launch)}::jsonb, true), status = 'ACTIVE'
    WHERE id = ${projectId}`;
  return { launch, published: published.length };
}
