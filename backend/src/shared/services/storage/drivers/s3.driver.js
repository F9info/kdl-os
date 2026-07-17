// S3 driver — AWS S3 or any S3-compatible endpoint (including Cloudflare R2).
// For R2: set STORAGE_DRIVER=r2 to wire a custom endpoint automatically (see index.js).
// This file handles pure S3 protocol; endpoint customisation is done at driver creation.

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const resolveClientConfig = (opts = {}, creds = {}) => {
  const base = {
    region: creds.region || process.env.AWS_REGION || process.env.MINIO_REGION || 'us-east-1',
    credentials: {
      accessKeyId: creds.accessKey || process.env.AWS_ACCESS_KEY_ID || process.env.MINIO_ACCESS_KEY,
      secretAccessKey: creds.secretKey || process.env.AWS_SECRET_ACCESS_KEY || process.env.MINIO_SECRET_KEY,
    },
  };
  const endpoint = opts.endpoint || creds.endpoint || process.env.S3_ENDPOINT;
  if (endpoint) {
    base.endpoint = endpoint;
    // Needed for custom endpoints (MinIO, R2, Wasabi): prevents virtual-hosted bucket path
    base.forcePathStyle = true;
  }
  return base;
};

// creds: optional runtime overrides for { region, bucket, accessKey, secretKey, endpoint }.
// Falls back to env vars when not provided (backward-compatible).
export const makeS3Driver = (opts = {}, creds = {}) => {
  const client = new S3Client(resolveClientConfig(opts, creds));
  const BUCKET = creds.bucket || process.env.S3_BUCKET || process.env.MINIO_BUCKET;

  return {
    async put(file, objectName) {
      await client.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: objectName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      }));
    },

    async get(objectName) {
      const resp = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: objectName }));
      return resp.Body; // ReadableStream — callers iterate it
    },

    async delete(objectName) {
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: objectName }));
    },

    async deleteMany(objectNames) {
      if (!objectNames.length) return;
      await client.send(new DeleteObjectsCommand({
        Bucket: BUCKET,
        Delete: { Objects: objectNames.map((Key) => ({ Key })), Quiet: true },
      }));
    },

    async presign(objectName, expirySeconds = 7 * 24 * 60 * 60) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: BUCKET, Key: objectName }),
        { expiresIn: expirySeconds }
      );
    },

    async copy(srcObjectName, destObjectName) {
      await client.send(new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${srcObjectName}`,
        Key: destObjectName,
      }));
    },

    async ensureBucket() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: BUCKET }));
      } catch (err) {
        if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
          await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
        } else {
          throw err;
        }
      }
    },
  };
};
