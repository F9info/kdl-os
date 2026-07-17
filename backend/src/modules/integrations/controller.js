import { prisma } from '../../config/database.js';
import { successResponse, errorResponse } from '../../shared/utils/response.js';
import { writeActivityAsync, getClientIp } from '../user-management/shared/activity-logger.js';
import { getDriver } from './drivers/index.js';
import { encrypt, decrypt } from './shared/crypto.js';
import { integrationsQueue } from './integrations.queue.js';
import { maskRecipient, scrubPii } from './service.js';
import { createProviderSchema, updateProviderSchema, testSendSchema, getLogsQuerySchema } from './schema.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { logger } from '../../shared/utils/logger.js';
import { assertPublicHost } from '../../shared/utils/ssrf-guard.js';

const SAFE_SELECT = {
  id: true,
  channel: true,
  driver: true,
  name: true,
  config: true,
  is_active: true,
  is_default: true,
  is_fallback: true,
  created_at: true,
  updated_at: true,
};

export const getProviders = async (req, res, next) => {
  try {
    const providers = await prisma.integrationProvider.findMany({
      select: SAFE_SELECT,
      orderBy: [{ channel: 'asc' }, { created_at: 'asc' }],
    });
    successResponse(res, { items: providers.map((p) => ({ ...p, credentials_set: true })) });
  } catch (err) {
    next(err);
  }
};

export const createProvider = async (req, res, next) => {
  try {
    const data = createProviderSchema.parse(req.body);

    let driver;
    try {
      driver = getDriver(data.driver);
    } catch {
      return errorResponse(res, `Unknown driver: ${data.driver}`, 422);
    }

    if (driver.channel !== data.channel) {
      return errorResponse(
        res,
        `Driver "${data.driver}" handles channel ${driver.channel}, not ${data.channel}`,
        422,
      );
    }

    const credResult = driver.credentialsSchema.safeParse(data.credentials);
    if (!credResult.success) {
      return errorResponse(res, `Invalid credentials: ${credResult.error.message}`, 422);
    }

    // L7: async DNS-based SSRF guard for drivers that connect to a user-supplied host.
    if (data.driver === 'smtp' && credResult.data.host) {
      await assertPublicHost(credResult.data.host);
    }

    if (driver.configSchema && data.config && Object.keys(data.config).length > 0) {
      const cfgResult = driver.configSchema.safeParse(data.config);
      if (!cfgResult.success) {
        return errorResponse(res, `Invalid config: ${cfgResult.error.message}`, 422);
      }
    }

    if (data.is_default) {
      const existing = await prisma.integrationProvider.findFirst({
        where: { channel: data.channel, is_default: true },
        select: { id: true },
      });
      if (existing) {
        return errorResponse(res, `A default provider for channel ${data.channel} already exists`, 409);
      }
    }

    const provider = await prisma.integrationProvider.create({
      data: {
        channel: data.channel,
        driver: data.driver,
        name: data.name,
        credentials: encrypt(JSON.stringify(credResult.data)),
        config: data.config ?? {},
        is_active: data.is_active,
        is_default: data.is_default,
        is_fallback: data.is_fallback,
      },
      select: SAFE_SELECT,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'integrations',
      action: 'provider_created',
      description: `Provider "${data.name}" (${data.driver}) created for channel ${data.channel}`,
      properties: { provider_id: provider.id, channel: data.channel, driver: data.driver },
      ip_address: getClientIp(req),
    });

    successResponse(res, { item: { ...provider, credentials_set: true } }, 201);
  } catch (err) {
    if (err.name === 'ZodError') return errorResponse(res, err.message, 422);
    next(err);
  }
};

export const updateProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateProviderSchema.parse(req.body);

    const existing = await prisma.integrationProvider.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'Provider not found', 404);

    if (data.is_default === true && !existing.is_default) {
      const conflict = await prisma.integrationProvider.findFirst({
        where: { channel: existing.channel, is_default: true, id: { not: id } },
        select: { id: true },
      });
      if (conflict) {
        return errorResponse(res, `A default provider for channel ${existing.channel} already exists`, 409);
      }
    }

    let driver;
    try {
      driver = getDriver(existing.driver);
    } catch {
      return errorResponse(res, `Unknown driver: ${existing.driver}`, 422);
    }

    let encryptedCredentials;
    if (data.credentials !== undefined) {
      const credResult = driver.credentialsSchema.safeParse(data.credentials);
      if (!credResult.success) {
        return errorResponse(res, `Invalid credentials: ${credResult.error.message}`, 422);
      }
      // L7: async DNS-based SSRF guard on host update.
      if (existing.driver === 'smtp' && credResult.data.host) {
        await assertPublicHost(credResult.data.host);
      }
      encryptedCredentials = encrypt(JSON.stringify(credResult.data));
    }

    if (data.config !== undefined && driver.configSchema) {
      const cfgResult = driver.configSchema.safeParse(data.config);
      if (!cfgResult.success) {
        return errorResponse(res, `Invalid config: ${cfgResult.error.message}`, 422);
      }
    }

    const update = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.config !== undefined) update.config = data.config;
    if (data.is_active !== undefined) update.is_active = data.is_active;
    if (data.is_default !== undefined) update.is_default = data.is_default;
    if (data.is_fallback !== undefined) update.is_fallback = data.is_fallback;
    if (encryptedCredentials !== undefined) update.credentials = encryptedCredentials;

    const updated = await prisma.integrationProvider.update({
      where: { id },
      data: update,
      select: SAFE_SELECT,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'integrations',
      action: 'provider_updated',
      description: `Provider "${updated.name}" updated`,
      properties: {
        provider_id: id,
        fields_changed: Object.keys(data).filter((k) => k !== 'credentials'),
      },
      ip_address: getClientIp(req),
    });

    successResponse(res, { item: { ...updated, credentials_set: true } });
  } catch (err) {
    if (err.name === 'ZodError') return errorResponse(res, err.message, 422);
    next(err);
  }
};

export const deleteProvider = async (req, res, next) => {
  try {
    const { id } = req.params;

    const provider = await prisma.integrationProvider.findUnique({
      where: { id },
      select: { id: true, name: true, channel: true, driver: true, is_default: true },
    });
    if (!provider) return errorResponse(res, 'Provider not found', 404);

    if (provider.is_default) {
      const waitingCount = await integrationsQueue.getWaitingCount();
      if (waitingCount > 0) {
        return errorResponse(res, 'Cannot delete default provider while jobs are queued', 409);
      }
    }

    await prisma.integrationProvider.delete({ where: { id } });

    writeActivityAsync({
      actor: req.user.id,
      module: 'integrations',
      action: 'provider_deleted',
      description: `Provider "${provider.name}" deleted`,
      properties: { provider_id: id, channel: provider.channel, driver: provider.driver },
      ip_address: getClientIp(req),
    });

    successResponse(res, null, 204);
  } catch (err) {
    next(err);
  }
};

export const testProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = testSendSchema.parse(req.body);

    const provider = await prisma.integrationProvider.findUnique({
      where: { id },
      select: { id: true, name: true, channel: true },
    });
    if (!provider) return errorResponse(res, 'Provider not found', 404);

    const log = await prisma.integrationLog.create({
      data: {
        channel: provider.channel,
        recipient: maskRecipient(data.to),
        subject: data.subject ?? null,
        body_preview: scrubPii(data.body).slice(0, 120),
        status: 'QUEUED',
        source: 'test',
        provider_id: provider.id,
      },
    });

    await integrationsQueue.add('send', {
      logId: log.id,
      channel: provider.channel,
      to: data.to,
      subject: data.subject ?? null,
      body: data.body,
      source: 'test',
      meta: null,
      providerId: id,
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'integrations',
      action: 'provider_test_sent',
      description: `Test message sent via provider "${provider.name}"`,
      properties: { provider_id: id, log_id: log.id },
      ip_address: getClientIp(req),
    });

    successResponse(res, { log_id: log.id });
  } catch (err) {
    if (err.name === 'ZodError') return errorResponse(res, err.message, 422);
    next(err);
  }
};

export const webhookGetHandler = async (req, res, next) => {
  const { driver: driverName } = req.params;
  let driver;
  try {
    driver = getDriver(driverName);
  } catch {
    return errorResponse(res, 'Unknown driver', 404);
  }

  if (typeof driver.verifyGetChallenge !== 'function') {
    return errorResponse(res, 'Method not allowed', 405);
  }

  try {
    const providers = await prisma.integrationProvider.findMany({
      where: { driver: driverName, is_active: true },
      select: { config: true },
    });

    for (const provider of providers) {
      const challenge = driver.verifyGetChallenge(req, null, provider.config ?? {});
      if (challenge) {
        return res.status(200).send(challenge);
      }
    }

    logger.warn(`Webhook GET verification failed for driver "${driverName}" from ${getClientIp(req)}`);
    return errorResponse(res, 'Verification failed', 403);
  } catch (err) {
    next(err);
  }
};

export const webhookHandler = async (req, res, next) => {
  const { driver: driverName } = req.params;
  let driver;
  try {
    driver = getDriver(driverName);
  } catch {
    return errorResponse(res, 'Unknown driver', 404);
  }

  // L10: narrow provider search using a payload-derived identifier when the
  // driver supports it, so we only try providers that plausibly match.
  const providerKey = driver.getWebhookProviderKey?.(req) ?? null;

  let allProviders = await prisma.integrationProvider.findMany({
    where: { driver: driverName, is_active: true },
    select: { id: true, credentials: true, config: true },
  }).catch(() => []);

  // Filter in-memory by the payload identifier (e.g. phone_number_id for meta-cloud).
  // Fall back to all providers when the driver exposes no key or the payload lacks it.
  const providers = providerKey && driver.getWebhookProviderKey
    ? allProviders.filter((p) => {
        try {
          const cfg = p.config ?? {};
          return Object.values(cfg).includes(providerKey);
        } catch { return false; }
      }).length > 0
      ? allProviders.filter((p) => {
          try {
            return Object.values(p.config ?? {}).includes(providerKey);
          } catch { return false; }
        })
      : allProviders // fall back if filter yields nothing (safety net)
    : allProviders;

  let verified = false;
  for (const provider of providers) {
    let credentials = null;
    let config = null;
    try {
      credentials = JSON.parse(decrypt(provider.credentials));
      config = provider.config ?? {};
    } catch {
      continue;
    }
    if (driver.verifySignature?.(req, credentials, config) ?? false) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    logger.warn(`Webhook signature verification failed for driver "${driverName}" from ${getClientIp(req)}`);
    return errorResponse(res, 'Signature verification failed', 401);
  }

  try {
    const parsed = driver.parseWebhook(req);
    if (!parsed) return res.status(200).end();

    const { provider_ref, status } = parsed;

    const log = await prisma.integrationLog.findFirst({
      where: { provider_ref },
      select: { id: true, status: true },
    });

    if (!log) return res.status(200).end();

    const update = { status };
    if (status === 'DELIVERED' || status === 'READ') {
      update.delivered_at = new Date();
    }

    await prisma.integrationLog.update({ where: { id: log.id }, data: update });

    return res.status(200).end();
  } catch (err) {
    next(err);
  }
};

export const getLogs = async (req, res, next) => {
  try {
    const q = req.validated?.query ?? req.query;
    const { page, limit, skip } = getPaginationParams(q);
    const where = {};

    if (q.channel) where.channel = q.channel;
    if (q.status) where.status = q.status;
    if (q.source) where.source = q.source;

    const range = {};
    if (q.from) range.gte = new Date(q.from);
    if (q.to) range.lte = new Date(q.to);
    if (Object.keys(range).length) where.created_at = range;

    const [logs, total] = await Promise.all([
      prisma.integrationLog.findMany({
        where,
        select: {
          id: true,
          channel: true,
          recipient: true,
          subject: true,
          status: true,
          source: true,
          provider_ref: true,
          error: true,
          attempts: true,
          sent_at: true,
          delivered_at: true,
          created_at: true,
          provider: { select: { id: true, name: true, driver: true } },
        },
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      prisma.integrationLog.count({ where }),
    ]);

    successResponse(res, {
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};
