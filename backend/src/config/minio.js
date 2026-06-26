import { Client } from 'minio';

// Internal client — used for object operations (put/get/remove). In Docker this
// must reach the `minio` service over the internal network (minio:9000).
const REGION = process.env.MINIO_REGION || 'us-east-1';

const minio = new Client({
  endPoint: process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PORT, 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  region: REGION,
});

// Public client — used ONLY to generate presigned URLs a browser can reach.
// Presigning is a local HMAC operation (no network), so this client points at the
// host-facing endpoint (e.g. localhost:9002). Falls back to the internal endpoint
// when no public override is configured (non-Docker / local dev).
const minioPublic = new Client({
  endPoint: process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT,
  port: parseInt(process.env.MINIO_PUBLIC_PORT || process.env.MINIO_PORT, 10),
  useSSL: (process.env.MINIO_PUBLIC_USE_SSL ?? process.env.MINIO_USE_SSL) === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY,
  // Explicit region so presigning is a pure local operation (no region lookup
  // against the unreachable host endpoint from inside the container).
  region: REGION,
});

export { minio, minioPublic };
