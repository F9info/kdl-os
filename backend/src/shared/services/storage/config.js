import { logger } from '../../utils/logger.js';

// Lazy import prisma to avoid circular-dep issues during module init.
const getPrisma = () => import('../../../config/database.js').then((m) => m.prisma);

// Lazy import decrypt — only needed when DB has encrypted secrets.
const getDecrypt = () => import('../../utils/crypto.js').then((m) => m.decrypt);

const SETTING_KEYS = [
  'storage.provider',
  'storage.endpoint',
  'storage.region',
  'storage.bucket',
  'storage.access_key',
  'storage.secret_key',
];

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30_000;

const fromEnv = () => ({
  provider: (process.env.STORAGE_DRIVER || 'minio').toLowerCase(),
  endpoint: process.env.S3_ENDPOINT || null,
  region: process.env.AWS_REGION || process.env.MINIO_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || null,
  accessKey: process.env.AWS_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY || null,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY || null,
});

export const invalidateStorageCache = () => {
  _cache = null;
  _cacheTime = 0;
};

export const getStorageConfig = async () => {
  if (_cache && Date.now() - _cacheTime < CACHE_TTL) return _cache;

  try {
    const prisma = await getPrisma();
    const rows = await prisma.appSetting.findMany({
      where: { key: { in: SETTING_KEYS } },
    });

    if (!rows.length) {
      _cache = fromEnv();
      _cacheTime = Date.now();
      return _cache;
    }

    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

    if (!map['storage.provider']) {
      _cache = fromEnv();
      _cacheTime = Date.now();
      return _cache;
    }

    const decrypt = await getDecrypt();
    const safeDecrypt = (val) => {
      if (!val) return null;
      try { return decrypt(val); } catch {
        logger.warn('storage: failed to decrypt secret — treating as empty');
        return null;
      }
    };

    _cache = {
      provider: map['storage.provider'],
      endpoint: map['storage.endpoint'] || null,
      region: map['storage.region'] || 'us-east-1',
      bucket: map['storage.bucket'] || null,
      accessKey: safeDecrypt(map['storage.access_key']),
      secretKey: safeDecrypt(map['storage.secret_key']),
    };
    _cacheTime = Date.now();
    return _cache;
  } catch (err) {
    logger.warn(`storage: config DB read failed (${err.message}) — using env vars`);
    _cache = fromEnv();
    _cacheTime = Date.now();
    return _cache;
  }
};
