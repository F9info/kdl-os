import { Client } from 'minio';

const REGION = process.env.MINIO_REGION || 'us-east-1';
const BUCKET = process.env.MINIO_BUCKET;

const internalClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: REGION,
});

// Public client: points at the host-facing endpoint for presign (local HMAC, no network).
const publicClient = new Client({
  endPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT, 10),
  useSSL: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL) === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: REGION,
});

export const minioDriver = {
  async put(file, objectName) {
    await internalClient.putObject(BUCKET, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
  },

  async get(objectName) {
    return internalClient.getObject(BUCKET, objectName);
  },

  async delete(objectName) {
    await internalClient.removeObject(BUCKET, objectName);
  },

  async deleteMany(objectNames) {
    await Promise.all(objectNames.map((n) => internalClient.removeObject(BUCKET, n)));
  },

  async presign(objectName, expirySeconds = 7 * 24 * 60 * 60) {
    return publicClient.presignedGetObject(BUCKET, objectName, expirySeconds);
  },

  async copy(srcObjectName, destObjectName) {
    await internalClient.copyObject(BUCKET, destObjectName, `/${BUCKET}/${srcObjectName}`);
  },

  async ensureBucket() {
    const exists = await internalClient.bucketExists(BUCKET);
    if (!exists) await internalClient.makeBucket(BUCKET, REGION);
  },
};
