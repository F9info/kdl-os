import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';

const getStorageDir = () =>
  path.resolve(process.env.LOCAL_STORAGE_PATH || 'uploads/media');

const getBaseUrl = () =>
  process.env.LOCAL_STORAGE_BASE_URL ||
  process.env.BACKEND_URL ||
  `http://localhost:${process.env.APP_PORT || 4000}`;

const resolveFilePath = (objectName) =>
  path.join(getStorageDir(), objectName);

// HMAC key for signing/verifying presign URLs (same parity as S3 presign security model).
// Use a dedicated LOCAL_PRESIGN_SECRET to isolate presign keys from other secrets.
const getSigningKey = () => {
  const k = process.env.LOCAL_PRESIGN_SECRET || process.env.APP_ENCRYPTION_KEY;
  if (!k) throw new Error('LOCAL_PRESIGN_SECRET or APP_ENCRYPTION_KEY is required for local storage presign');
  return k;
};

const sign = (objectName, expiresAt) =>
  crypto
    .createHmac('sha256', getSigningKey())
    .update(`${objectName}:${expiresAt}`)
    .digest('base64url');

export const verifyLocalPresignToken = (objectName, token, expiresAtStr) => {
  const expiresAt = parseInt(expiresAtStr, 10);
  if (!expiresAt || Date.now() > expiresAt) return false;
  const expected = sign(objectName, expiresAt);
  try {
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
};

export const makeLocalDriver = () => ({
  async put(file, objectName) {
    const dest = resolveFilePath(objectName);
    await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    await fsPromises.writeFile(dest, file.buffer);
  },

  async get(objectName) {
    return fs.createReadStream(resolveFilePath(objectName));
  },

  async delete(objectName) {
    await fsPromises.unlink(resolveFilePath(objectName)).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  },

  async deleteMany(objectNames) {
    await Promise.all(objectNames.map((n) => this.delete(n)));
  },

  // Returns a time-limited HMAC-signed URL — same security model as S3 presigned URLs.
  async presign(objectName, expirySeconds = 7 * 24 * 60 * 60) {
    const expiresAt = Date.now() + expirySeconds * 1000;
    const token = sign(objectName, expiresAt);
    const encoded = objectName.split('/').map(encodeURIComponent).join('/');
    return `${getBaseUrl()}/api/storage/local/${encoded}?token=${token}&exp=${expiresAt}`;
  },

  async copy(srcObjectName, destObjectName) {
    const dest = resolveFilePath(destObjectName);
    await fsPromises.mkdir(path.dirname(dest), { recursive: true });
    await fsPromises.copyFile(resolveFilePath(srcObjectName), dest);
  },

  async ensureBucket() {
    await fsPromises.mkdir(getStorageDir(), { recursive: true });
  },
});
