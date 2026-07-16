import { prisma } from '../../config/database.js';
import { encrypt, decrypt } from '../../shared/utils/crypto.js';
import { invalidateStorageCache } from '../../shared/services/storage/config.js';
import { invalidateDriverCache, makeDriver } from '../../shared/services/storage/index.js';
import { logger } from '../../shared/utils/logger.js';
import { assertPublicEndpoint } from '../../shared/utils/ssrf-guard.js';

const DB_KEYS = {
  provider: 'storage.provider',
  endpoint: 'storage.endpoint',
  region: 'storage.region',
  bucket: 'storage.bucket',
  accessKey: 'storage.access_key',
  secretKey: 'storage.secret_key',
};

const ENCRYPTED_FIELDS = new Set(['accessKey', 'secretKey']);

const mask = (value) => {
  if (!value) return null;
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}${'*'.repeat(value.length - 6)}${value.slice(-3)}`;
};

const safeDecrypt = (val) => {
  if (!val) return null;
  try { return decrypt(val); } catch { return null; }
};

const upsertSetting = async (key, value) => {
  if (value === null || value === '' || value === undefined) {
    await prisma.appSetting.deleteMany({ where: { key } });
  } else {
    await prisma.appSetting.upsert({
      where: { key },
      create: { key, value, type: 'string', is_public: false },
      update: { value },
    });
  }
};

const loadRawRows = async () => {
  const rows = await prisma.appSetting.findMany({
    where: { key: { in: Object.values(DB_KEYS) } },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};

export const getStorageSettings = async () => {
  const map = await loadRawRows();

  return {
    provider: map[DB_KEYS.provider] || null,
    endpoint: map[DB_KEYS.endpoint] || null,
    region: map[DB_KEYS.region] || null,
    bucket: map[DB_KEYS.bucket] || null,
    accessKey: mask(safeDecrypt(map[DB_KEYS.accessKey])),
    secretKey: mask(safeDecrypt(map[DB_KEYS.secretKey])),
    isConfigured: !!map[DB_KEYS.provider],
  };
};

export const updateStorageSettings = async (data) => {
  if (data.endpoint) await assertPublicEndpoint(data.endpoint);
  const plain = { provider: data.provider, endpoint: data.endpoint, region: data.region, bucket: data.bucket };
  for (const [field, key] of Object.entries(DB_KEYS)) {
    if (field in plain && plain[field] !== undefined) {
      await upsertSetting(key, plain[field]);
    }
  }

  if (data.accessKey !== undefined) {
    const val = data.accessKey ? encrypt(data.accessKey) : null;
    await upsertSetting(DB_KEYS.accessKey, val);
  }
  if (data.secretKey !== undefined) {
    const val = data.secretKey ? encrypt(data.secretKey) : null;
    await upsertSetting(DB_KEYS.secretKey, val);
  }

  invalidateStorageCache();
  invalidateDriverCache();

  return getStorageSettings();
};

export const testStorageConnection = async (data = {}) => {
  if (data.endpoint) await assertPublicEndpoint(data.endpoint);
  // Build effective config: merge saved settings with any overrides in data.
  const map = await loadRawRows();

  const config = {
    provider: data.provider || map[DB_KEYS.provider] || null,
    endpoint: data.endpoint !== undefined ? data.endpoint : (map[DB_KEYS.endpoint] || null),
    region: data.region || map[DB_KEYS.region] || 'us-east-1',
    bucket: data.bucket || map[DB_KEYS.bucket] || null,
    accessKey: data.accessKey || safeDecrypt(map[DB_KEYS.accessKey]),
    secretKey: data.secretKey || safeDecrypt(map[DB_KEYS.secretKey]),
  };

  if (!config.provider) {
    throw Object.assign(new Error('No storage provider configured'), { status: 400 });
  }

  let driver;
  try {
    driver = makeDriver(config);
  } catch (err) {
    throw Object.assign(new Error(`Invalid config: ${err.message}`), { status: 400 });
  }

  try {
    await driver.ensureBucket();
    return {
      ok: true,
      provider: config.provider,
      bucket: config.bucket || '(local)',
      message: `Connected successfully to ${config.provider}${config.bucket ? `/${config.bucket}` : ''}`,
    };
  } catch (err) {
    logger.warn(`storage: test connection failed for ${config.provider}: ${err.message}`);
    throw Object.assign(
      new Error(`Connection test failed: ${err.message}`),
      { status: 422 }
    );
  }
};
