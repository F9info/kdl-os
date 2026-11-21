// Debounced "rebuild this project's generated site" job. Only projects that
// already have a generated folder (marker file) are rebuilt — changes made
// before the user opens Web app in the wizard cost nothing.

import { Queue } from 'bullmq';
import { logger } from '../../../shared/utils/logger.js';
import { buildSite, listGeneratedProjectIds, siteExists } from './generator.js';
import { prisma } from '../../../config/database.js';
import { getDefaultProjectId } from '../../../shared/default-project.js';

const NAME = 'site-build';
// Lazy: importing a service that triggers builds must not open a Redis
// connection (unit tests import those services with prisma mocked).
let queue;
async function getQueue() {
  if (!queue) {
    const { redis } = await import('../../../config/redis.js');
    queue = new Queue(NAME, {
      connection: redis,
      defaultJobOptions: { attempts: 2, removeOnComplete: true, removeOnFail: 50 },
    });
  }
  return queue;
}

// Fire-and-forget: a queue failure must never break the admin mutation.
export async function enqueueSiteBuild(projectId) {
  if (!projectId || process.env.NODE_ENV === 'test') return;
  try {
    // One build per 2s window: a burst of edits collapses into one job, and an
    // edit landing while a build runs gets the next window's job (a fixed
    // jobId would be ignored while the previous job is active — lost update).
    const window = Math.floor(Date.now() / 2000);
    await (await getQueue()).add('build', { projectId }, { jobId: `site-${projectId}-${window}`, delay: 2000 });
  } catch (e) {
    logger.warn(`site-build enqueue failed: ${e.message}`);
  }
}

/**
 * The installer's first build of the default project's site (a type with a website). Unlike
 * enqueueSiteBuild, the job may create the folder: before this, a new server had website pages in the
 * database but no generated site, so / had nothing to serve until someone generated it by hand.
 */
// Without a projectId the worker builds the default project (resolved when the job runs).
export async function enqueueInitialSiteBuild(projectId = null) {
  if (process.env.NODE_ENV === 'test') return;
  try {
    await (await getQueue()).add('build', { projectId, initial: true }, { jobId: `site-initial-${projectId ?? 'default'}-${Date.now()}` });
  } catch (e) {
    logger.warn(`initial site-build enqueue failed: ${e.message}`);
  }
}

/** For global changes (settings, theme) that affect every generated site. */
export async function enqueueAllSiteBuilds() {
  if (process.env.NODE_ENV === 'test') return;
  for (const id of await listGeneratedProjectIds()) await enqueueSiteBuild(id);
}

// One job. Edit-triggered jobs only refresh a site that was generated already; `initial` (the
// installer) may create it.
export async function processSiteBuild(data) {
  if (data.initial) {
    // Before the first build: the Studio steps a person would do by hand (palette, fonts, layout, menu
    // pages), so Frontend > Brands / Color Palette / Navigation / Layouts / Pages work and the site has
    // its pages. Best effort: the site is built either way.
    try {
      const { completeStudioDefaults } = await import('../../../shared/install/studio-defaults.js');
      const r = await completeStudioDefaults({ log: (m) => logger.info(m) });
      logger.info(`studio defaults: ${r.status}${r.steps?.length ? ` (${r.steps.join(', ')})` : ''}${r.reason ? ` - ${r.reason}` : ''}`);
    } catch (e) {
      logger.error(`studio defaults failed: ${e.code ?? ''} ${e.message}`);
    }
  }
  const projectId = data.projectId ?? (data.initial ? await getDefaultProjectId(prisma) : null);
  if (!projectId) return 'skipped';
  const project = await prisma.project.findFirst({ where: { id: projectId, deleted_at: null } });
  if (!project) return 'skipped';
  if (!data.initial && !(await siteExists(project.slug))) return 'skipped';
  const r = await buildSite(projectId);
  logger.info(`site-build ${r.slug}: ${r.pages} pages${data.initial ? ' (first build)' : ''}`);
  return r.slug;
}

export async function startSiteBuildWorker() {
  if (process.env.NODE_ENV === 'test') return null;
  const { Worker } = await import('bullmq');
  const { default: Redis } = await import('ioredis');
  const conn = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const worker = new Worker(
    NAME,
    async ({ data }) => processSiteBuild(data),
    { connection: conn, concurrency: 1 }
  );
  worker.on('failed', (job, err) => logger.error(`site-build failed ${job?.id}: ${err.message}`));
  return worker;
}
