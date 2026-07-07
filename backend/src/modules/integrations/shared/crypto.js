import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard nonce size
const KEY_ENV = 'APP_ENCRYPTION_KEY';

function loadKey() {
  const hex = process.env[KEY_ENV];
  if (!hex) {
    throw new Error(`${KEY_ENV} env var is required (32-byte hex string)`);
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`${KEY_ENV} must be a 32-byte hex string (64 hex characters)`);
  }
  return Buffer.from(hex, 'hex');
}

// Fail fast at startup — a missing/malformed key must never reach the send path.
const key = loadKey();

/**
 * Encrypt a plaintext string. Returns `iv:tag:ciphertext` (each part base64).
 */
export function encrypt(plaintext) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypt an `iv:tag:ciphertext` payload produced by encrypt().
 * Throws on tampered data or wrong key (GCM auth failure).
 */
export function decrypt(payload) {
  const parts = String(payload).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format — expected iv:tag:ciphertext');
  }
  const [iv, tag, ciphertext] = parts.map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
