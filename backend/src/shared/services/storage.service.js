import { minio, minioPublic } from '../../config/minio.js';

const BUCKET = process.env.MINIO_BUCKET;

export const uploadFile = async (file, objectName) => {
  await minio.putObject(BUCKET, objectName, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });
  return getFileUrl(objectName);
};

export const copyFile = async (srcObjectName, destObjectName) => {
  await minio.copyObject(BUCKET, destObjectName, `/${BUCKET}/${srcObjectName}`);
};

export const deleteFile = async (objectName) => {
  await minio.removeObject(BUCKET, objectName);
};

export const deleteFiles = async (objectNames) => {
  await Promise.all(objectNames.map((name) => minio.removeObject(BUCKET, name)));
};

export const getFileUrl = async (objectName, expiry = 7 * 24 * 60 * 60) => {
  // Generated against the public endpoint so the returned URL is browser-reachable.
  return minioPublic.presignedGetObject(BUCKET, objectName, expiry);
};

export const ensureBucketExists = async () => {
  const exists = await minio.bucketExists(BUCKET);
  if (!exists) {
    await minio.makeBucket(BUCKET, 'us-east-1');
  }
};
