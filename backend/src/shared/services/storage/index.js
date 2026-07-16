// Storage driver selector.
// Static providers (resolved once from env): minio, s3, r2.
// Dynamic providers (resolved from app_settings with 30s cache): local, spaces, and all of the above.
// Use getActiveDriver() for all new code; it reads from DB settings first, falls back to env.

import { minioDriver } from './drivers/minio.driver.js';
import { makeS3Driver } from './drivers/s3.driver.js';
import { makeLocalDriver } from './drivers/local.driver.js';
import { getStorageConfig, invalidateStorageCache } from './config.js';

export { invalidateStorageCache };

// Build a driver from a resolved config object.
export const makeDriver = (config) => {
  const { provider, endpoint, region, bucket, accessKey, secretKey } = config;
  const creds = { region, bucket, accessKey, secretKey };

  switch (provider) {
    case 'local':
      return makeLocalDriver();

    case 'minio':
      // Minio driver is env-based; DB creds are ignored (minio needs its own SDK config).
      return minioDriver;

    case 's3':
      return makeS3Driver({}, creds);

    case 'spaces':
      // DigitalOcean Spaces — S3-compatible; endpoint is derived from region.
      return makeS3Driver({
        endpoint: endpoint || `https://${region || 'nyc3'}.digitaloceanspaces.com`,
      }, creds);

    case 'r2':
      return makeS3Driver({
        endpoint: endpoint || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      }, creds);

    default:
      throw new Error(`Unknown storage provider "${provider}". Valid values: local, minio, s3, spaces, r2`);
  }
};

let _driverCache = null;
let _driverCacheKey = null;

export const invalidateDriverCache = () => {
  _driverCache = null;
  _driverCacheKey = null;
};

export const getActiveDriver = async () => {
  const config = await getStorageConfig();
  const cacheKey = `${config.provider}:${config.endpoint}:${config.bucket}:${config.region}`;

  if (_driverCache && _driverCacheKey === cacheKey) return _driverCache;

  _driverCache = makeDriver(config);
  _driverCacheKey = cacheKey;
  return _driverCache;
};

// Legacy export — kept so any direct imports still work.
// Resolves once at startup from env; does NOT reflect DB settings changes.
// Prefer getActiveDriver() for all call sites.
export const activeDriver = makeDriver({
  provider: (process.env.STORAGE_DRIVER || 'minio').toLowerCase(),
  endpoint: process.env.S3_ENDPOINT || null,
  region: process.env.AWS_REGION || process.env.MINIO_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || process.env.MINIO_BUCKET || null,
  accessKey: process.env.AWS_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY || null,
  secretKey: process.env.AWS_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY || null,
});
