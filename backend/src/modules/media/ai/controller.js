import { prisma } from '../../../config/database.js';
import { successResponse, errorResponse } from '../../../shared/utils/response.js';
import { encrypt } from '../../../shared/utils/crypto.js';
import { writeActivityAsync, getClientIp } from '../../user-management/shared/activity-logger.js';
import registry, { getDriver, FEATURES } from './drivers/index.js';
import { getFeatureStatus, toDbFeature } from './ai-provider.service.js';
import { createAiProviderSchema, updateAiProviderSchema } from './schema.js';

const SAFE_SELECT = {
  id: true,
  feature: true,
  driver: true,
  name: true,
  config: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

const zodFieldSpec = (schema) =>
  Object.entries(schema.shape).map(([key, type]) => ({
    key,
    required: !type.isOptional(),
  }));

// Registry metadata for the settings UI: per-driver features + credential/config field specs.
export const listAiDrivers = async (req, res, next) => {
  try {
    const items = Object.values(registry).map((d) => ({
      driver: d.driver,
      features: d.features,
      credential_fields: zodFieldSpec(d.credentialsSchema),
      config_fields: zodFieldSpec(d.configSchema),
      ...(d.ops ? { ops: d.ops } : {}),
    }));
    successResponse(res, { items, features: Object.keys(FEATURES) });
  } catch (err) {
    next(err);
  }
};

// Per-feature configured flags — UI hides unconfigured AI features.
export const getAiStatus = async (req, res, next) => {
  try {
    successResponse(res, { features: await getFeatureStatus() });
  } catch (err) {
    next(err);
  }
};

export const listAiProviders = async (req, res, next) => {
  try {
    const providers = await prisma.aiProvider.findMany({
      select: SAFE_SELECT,
      orderBy: [{ feature: 'asc' }, { created_at: 'asc' }],
    });
    successResponse(res, { items: providers.map((p) => ({ ...p, credentials_set: true })) });
  } catch (err) {
    next(err);
  }
};

export const createAiProvider = async (req, res, next) => {
  try {
    const data = createAiProviderSchema.parse(req.body);

    let driver;
    try {
      driver = getDriver(data.driver);
    } catch {
      return errorResponse(res, `Unknown driver: ${data.driver}`, 422);
    }
    if (!driver.features.includes(data.feature)) {
      return errorResponse(
        res,
        `Driver "${data.driver}" handles ${driver.features.join(', ')}, not ${data.feature}`,
        422,
      );
    }

    const credResult = driver.credentialsSchema.safeParse(data.credentials);
    if (!credResult.success) {
      return errorResponse(res, `Invalid credentials: ${credResult.error.message}`, 422);
    }
    const cfgResult = driver.configSchema.safeParse(data.config ?? {});
    if (!cfgResult.success) {
      return errorResponse(res, `Invalid config: ${cfgResult.error.message}`, 422);
    }

    const dbFeature = toDbFeature(data.feature);
    const provider = await prisma.$transaction(async (tx) => {
      // One active provider per feature: activating this one deactivates siblings.
      if (data.is_active) {
        await tx.aiProvider.updateMany({
          where: { feature: dbFeature, is_active: true },
          data: { is_active: false },
        });
      }
      return tx.aiProvider.create({
        data: {
          feature: dbFeature,
          driver: data.driver,
          name: data.name,
          credentials: encrypt(JSON.stringify(credResult.data)),
          config: cfgResult.data,
          is_active: data.is_active,
        },
        select: SAFE_SELECT,
      });
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'media',
      action: 'ai_provider_created',
      description: `AI provider "${data.name}" (${data.driver}) created for feature ${data.feature}`,
      properties: { provider_id: provider.id, feature: data.feature, driver: data.driver },
      ip_address: getClientIp(req),
    });

    successResponse(res, { item: { ...provider, credentials_set: true } }, 201);
  } catch (err) {
    if (err.name === 'ZodError') return errorResponse(res, err.message, 422);
    next(err);
  }
};

export const updateAiProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = updateAiProviderSchema.parse(req.body);

    const existing = await prisma.aiProvider.findUnique({ where: { id } });
    if (!existing) return errorResponse(res, 'AI provider not found', 404);

    let driver;
    try {
      driver = getDriver(existing.driver);
    } catch {
      return errorResponse(res, `Unknown driver: ${existing.driver}`, 422);
    }

    const update = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.is_active !== undefined) update.is_active = data.is_active;
    if (data.credentials !== undefined) {
      const credResult = driver.credentialsSchema.safeParse(data.credentials);
      if (!credResult.success) {
        return errorResponse(res, `Invalid credentials: ${credResult.error.message}`, 422);
      }
      update.credentials = encrypt(JSON.stringify(credResult.data));
    }
    if (data.config !== undefined) {
      const cfgResult = driver.configSchema.safeParse(data.config);
      if (!cfgResult.success) {
        return errorResponse(res, `Invalid config: ${cfgResult.error.message}`, 422);
      }
      update.config = cfgResult.data;
    }

    const provider = await prisma.$transaction(async (tx) => {
      if (data.is_active === true) {
        await tx.aiProvider.updateMany({
          where: { feature: existing.feature, is_active: true, id: { not: id } },
          data: { is_active: false },
        });
      }
      return tx.aiProvider.update({ where: { id }, data: update, select: SAFE_SELECT });
    });

    writeActivityAsync({
      actor: req.user.id,
      module: 'media',
      action: 'ai_provider_updated',
      description: `AI provider "${provider.name}" updated`,
      properties: { provider_id: id, fields: Object.keys(update) },
      ip_address: getClientIp(req),
    });

    successResponse(res, { item: { ...provider, credentials_set: true } });
  } catch (err) {
    if (err.name === 'ZodError') return errorResponse(res, err.message, 422);
    next(err);
  }
};

export const deleteAiProvider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await prisma.aiProvider.findUnique({ where: { id }, select: { id: true, name: true, driver: true } });
    if (!existing) return errorResponse(res, 'AI provider not found', 404);

    await prisma.aiProvider.delete({ where: { id } });

    writeActivityAsync({
      actor: req.user.id,
      module: 'media',
      action: 'ai_provider_deleted',
      description: `AI provider "${existing.name}" (${existing.driver}) deleted`,
      properties: { provider_id: id },
      ip_address: getClientIp(req),
    });

    successResponse(res, { deleted: true });
  } catch (err) {
    next(err);
  }
};
