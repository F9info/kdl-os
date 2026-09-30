// Debounced "rebuild this project's generated site" job. Only projects that
// already have a generated folder (marker file) are rebuilt — changes made
// before the user opens Web app in the wizard cost nothing.

import { Queue } from 'bullmq';
import { logger } from '../../../shared/utils/logger.js';
import { buildSite, listGeneratedProjectIds, siteExists } from './generator.js';
import { prisma } from '../../../config/database.js';

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

/** For global changes (settings, theme) that affect every generated site. */
export async function enqueueAllSiteBuilds() {
  if (process.env.NODE_ENV === 'test') return;
  for (const id of await listGeneratedProjectIds()) await enqueueSiteBuild(id);
}

export async function startSiteBuildWorker() {
  if (process.env.NODE_ENV === 'test') return null;
  const { Worker } = await import('bullmq');
  const { default: Redis } = await import('ioredis');
  const conn = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
  const worker = new Worker(
    NAME,
    async ({ data }) => {
      const project = await prisma.project.findFirst({ where: { id: data.projectId, deleted_at: null } });
      if (!project || !(await siteExists(project.slug))) return 'skipped';
      const r = await buildSite(data.projectId);
      logger.info(`site-build ${r.slug}: ${r.pages} pages`);
      return r.slug;
    },
    { connection: conn, concurrency: 1 }
  );
  worker.on('failed', (job, err) => logger.error(`site-build failed ${job?.id}: ${err.message}`));
  return worker;
}
