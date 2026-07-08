// Storage driver selector — resolves active driver from STORAGE_DRIVER env.
// Valid values: minio (default), s3, r2.
// All drivers implement: put/get/delete/deleteMany/presign/copy/ensureBucket.

import { minioDriver } from './drivers/minio.driver.js';
import { makeS3Driver } from './drivers/s3.driver.js';

const DRIVER = (process.env.STORAGE_DRIVER || 'minio').toLowerCase();

const resolveDriver = () => {
  switch (DRIVER) {
    case 'minio':
      return minioDriver;

    case 's3':
      return makeS3Driver();

    case 'r2':
      // R2 is S3-compatible; endpoint is built from the account id.
      // Requires: R2_ACCOUNT_ID, AWS_ACCESS_KEY_ID (R2 API token id), AWS_SECRET_ACCESS_KEY
      return makeS3Driver({
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      });

    default:
      throw new Error(`Unknown STORAGE_DRIVER "${DRIVER}". Valid values: minio, s3, r2`);
  }
};

export const activeDriver = resolveDriver();
