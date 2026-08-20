import { Client } from 'minio';

const REGION = process.env.MINIO_REGION || 'us-east-1';
const BUCKET = process.env.MINIO_BUCKET;

// Clients are built on first use so that importing this module (or the storage
// barrel) does not throw InvalidEndpointError when MINIO_* env vars are absent
// (e.g. in test suites that mock only the database).
let _internalClient = null;
let _publicClient = null;

function getInternalClient() {
  if (!_internalClient) {
    _internalClient = new Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT, 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      region: REGION,
    });
  }
  return _internalClient;
}

function getPublicClient() {
  if (!_publicClient) {
    _publicClient = new Client({
      endPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT, 10),
      useSSL: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL) === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      region: REGION,
    });
  }
  return _publicClient;
}

export const minioDriver = {
  async put(file, objectName) {
    await getInternalClient().putObject(BUCKET, objectName, file.buffer, file.size, {
      'Content-Type': file.mimetype,
    });
  },

  async get(objectName) {
    return getInternalClient().getObject(BUCKET, objectName);
  },

  async delete(objectName) {
    await getInternalClient().removeObject(BUCKET, objectName);
  },

  async deleteMany(objectNames) {
    await Promise.all(objectNames.map((n) => getInternalClient().removeObject(BUCKET, n)));
  },

  async presign(objectName, expirySeconds = 7 * 24 * 60 * 60) {
    return getPublicClient().presignedGetObject(BUCKET, objectName, expirySeconds);
  },

  async copy(srcObjectName, destObjectName) {
    await getInternalClient().copyObject(BUCKET, destObjectName, `/${BUCKET}/${srcObjectName}`);
  },

  async ensureBucket() {
    const exists = await getInternalClient().bucketExists(BUCKET);
    if (!exists) await getInternalClient().makeBucket(BUCKET, REGION);
  },
};
