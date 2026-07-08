import { prisma } from '../../../config/database.js';
import { decrypt } from '../../../shared/utils/crypto.js';
import { errorResponse } from '../../../shared/utils/response.js';
import { logger } from '../../../shared/utils/logger.js';
import { getDriver, FEATURES } from './drivers/index.js';

export const FEATURE_KEYS = Object.keys(FEATURES); // ['vision', 'image_ops', 'speech_to_text']

export function toDbFeature(feature) {
  if (!FEATURE_KEYS.includes(feature)) {
    throw Object.assign(new Error(`Unknown AI feature: ${feature}`), { status: 422 });
  }
  return feature.toUpperCase();
}

/**
 * Resolve the active provider for a feature.
 * Returns { row, driver, credentials, config } or null when the feature is unconfigured.
 */
export async function getActiveProvider(feature) {
  const dbFeature = toDbFeature(feature);
  const row = await prisma.aiProvider.findFirst({
    where: { feature: dbFeature, is_active: true },
    orderBy: { updated_at: 'desc' },
  });
  if (!row) return null;

  let driver;
  try {
    driver = getDriver(row.driver);
  } catch (err) {
    logger.error(`AI provider ${row.id} references unknown driver "${row.driver}"`);
    return null;
  }

  let credentials;
  try {
    credentials = JSON.parse(decrypt(row.credentials));
  } catch (err) {
    logger.error(`AI provider ${row.id} credentials cannot be decrypted: ${err.message}`);
    return null;
  }

  return { row, driver, credentials, config: row.config ?? {} };
}

/**
 * Per-feature configured flags — drives UI visibility (unconfigured feature = hidden).
 */
export async function getFeatureStatus() {
  const active = await prisma.aiProvider.findMany({
    where: { is_active: true },
    select: { feature: true, driver: true },
  });
  const status = {};
  for (const key of FEATURE_KEYS) {
    const hit = active.find((p) => p.feature === key.toUpperCase());
    status[key] = { configured: Boolean(hit), driver: hit?.driver ?? null };
  }
  return status;
}

/**
 * Express middleware: 501 when no active provider for the feature (AI Rules).
 * On success attaches the resolved provider as req.aiProvider.
 */
export function requireFeature(feature) {
  return async (req, res, next) => {
    try {
      const provider = await getActiveProvider(feature);
      if (!provider) {
        return errorResponse(res, `AI feature "${feature}" is not configured`, 501);
      }
      req.aiProvider = provider;
      next();
    } catch (err) {
      next(err);
    }
  };
}
