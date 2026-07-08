import { Worker } from 'bullmq';
import { redis } from '../../config/redis.js';
import { prisma } from '../../config/database.js';
import { getModuleStatus } from '../../middleware/module-gate.js';
import { getDriver } from './drivers/index.js';
import { decrypt } from './shared/crypto.js';
import { logger } from '../../shared/utils/logger.js';

const RATE_PER_MINUTE = Number(process.env.INTEGRATIONS_RATE_PER_MINUTE) || 60;
const PARK_DELAY_MS = 30_000;

async function checkProviderRateLimit(providerId, ratePerMinute) {
  const key = `int:rl:${providerId}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 60);
  return count <= ratePerMinute;
}

async function resolveProvider(channel, providerId) {
  if (providerId) {
    return prisma.integrationProvider.findUnique({ where: { id: providerId } });
  }
  return prisma.integrationProvider.findFirst({
    where: { channel, is_active: true, is_default: true },
  });
}

async function sendViaProvider(provider, { to, subject, body, meta }) {
  if (!provider) throw new Error('No active default provider found');
  const driver = getDriver(provider.driver);
  const credentials = JSON.parse(decrypt(provider.credentials));
  return driver.send({ credentials, config: provider.config ?? {}, to, subject, body, meta });
}

export async function processIntegrationJob(job, token) {
  const { logId, channel, to, subject, body, meta, providerId } = job.data;

  const moduleStatus = await getModuleStatus('integrations');
  if (moduleStatus !== 'ENABLED') {
    logger.info(`Integrations worker: module disabled, parking job ${job.id}`);
    await job.moveToDelayed(Date.now() + PARK_DELAY_MS, token);
    return;
  }

  await prisma.integrationLog.update({
    where: { id: logId },
    data: { attempts: { increment: 1 } },
  });

  const maxAttempts = job.opts?.attempts ?? 4;
  const isLastAttempt = job.attemptsMade >= maxAttempts - 1;

  const mainProvider = await resolveProvider(channel, providerId);

  if (mainProvider) {
    const providerRate = Number(mainProvider.config?.rate_per_minute) || RATE_PER_MINUTE;
    const withinLimit = await checkProviderRateLimit(mainProvider.id, providerRate);
    if (!withinLimit) {
      logger.info(`Integrations job ${job.id}: provider ${mainProvider.id} rate limit reached, parking`);
      await job.moveToDelayed(Date.now() + 5_000, token);
      return;
    }
  }

  try {
    const result = await sendViaProvider(mainProvider, { to, subject, body, meta });
    await prisma.integrationLog.update({
      where: { id: logId },
      data: {
        status: 'SENT',
        provider_id: mainProvider.id,
        provider_ref: result.provider_ref ?? null,
        sent_at: new Date(),
      },
    });
    logger.info(`Integrations job ${job.id}: sent via provider ${mainProvider.id}`);
  } catch (mainErr) {
    logger.warn(`Integrations job ${job.id} attempt ${job.attemptsMade + 1} failed: ${mainErr.message}`);

    if (isLastAttempt && !providerId) {
      const fallback = await prisma.integrationProvider.findFirst({
        where: { channel, is_active: true, is_fallback: true },
      });

      if (fallback) {
        try {
          const result = await sendViaProvider(fallback, { to, subject, body, meta });
          await prisma.integrationLog.update({
            where: { id: logId },
            data: {
              status: 'SENT',
              provider_id: fallback.id,
              provider_ref: result.provider_ref ?? null,
              sent_at: new Date(),
            },
          });
          logger.info(`Integrations job ${job.id}: sent via fallback provider ${fallback.id}`);
          return;
        } catch (fallbackErr) {
          logger.error(`Integrations job ${job.id} fallback failed: ${fallbackErr.message}`);
          await prisma.integrationLog.update({
            where: { id: logId },
            data: { status: 'FAILED', error: fallbackErr.message },
          });
          throw fallbackErr;
        }
      }
    }

    if (isLastAttempt) {
      await prisma.integrationLog.update({
        where: { id: logId },
        data: { status: 'FAILED', error: mainErr.message },
      });
    }

    throw mainErr;
  }
}

export const integrationsWorker = process.env.NODE_ENV !== 'test'
  ? new Worker('integrations', processIntegrationJob, { connection: redis })
  : null;

if (integrationsWorker) {
  integrationsWorker.on('failed', (job, err) => {
    logger.error(`Integrations job ${job?.id} permanently failed: ${err.message}`);
  });
} else {
  logger.warn('Integrations worker not started: NODE_ENV=test');
}
