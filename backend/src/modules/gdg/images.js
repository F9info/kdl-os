import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import * as storage from '../../shared/services/storage.service.js';
import { verifyLocalPresignToken } from '../../shared/services/storage/drivers/local.driver.js';

// Images the DevFest website shows (speaker photos, sponsor logos, team photos). Stored under
// gdg/images/ and served at a permanent public address, because media-library links are signed and
// stop working after a few days.

const PREFIX = 'gdg/images/';
export const PUBLIC_BASE = '/api/gdg/public/images/';
/** A stored image name: a random id and a known image extension. Nothing else is ever served. */
export const IMAGE_NAME = /^[a-f0-9-]{36}\.(jpg|png|webp)$/;
export const IMAGE_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const fail = (status, message) => Object.assign(new Error(message), { status });

/**
 * A photo sent with a talk proposal: decoded, turned upright, cropped square around the face and
 * re-encoded as JPEG (which also drops the camera and GPS data). Returns its public address.
 */
export async function savePhoto(file) {
  let out;
  try {
    out = await sharp(file.buffer, { failOn: 'error', limitInputPixels: 50_000_000 })
      .rotate()
      .resize(800, 800, { fit: 'cover', position: sharp.strategy.attention })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
  } catch {
    throw fail(422, 'That file is not an image we can read. Use a JPG, PNG or WebP photo.');
  }
  const name = `${randomUUID()}.jpg`;
  await storage.uploadFile({ buffer: out, mimetype: 'image/jpeg', size: out.length, originalname: name }, PREFIX + name);
  return PUBLIC_BASE + name;
}

/**
 * Deletes a stored website image by its public address. Other addresses are ignored, and a failed
 * delete is only logged: a leftover file must never block the change that made it unused.
 */
export async function dropImage(url) {
  if (typeof url !== 'string' || !url.startsWith(PUBLIC_BASE)) return false;
  const name = url.slice(PUBLIC_BASE.length);
  if (!IMAGE_NAME.test(name)) return false;
  try {
    await storage.deleteFile(PREFIX + name);
    return true;
  } catch (err) {
    console.warn('[gdg] could not delete image', name, err?.message);
    return false;
  }
}

const LOCAL = '/api/storage/local/';

/**
 * An image picked from the media library arrives as a signed link that expires. Keep a permanent
 * copy for the website and return its address. Anything else (an outside link, a site path, an
 * already permanent image, an expired or forged link) is returned unchanged.
 */
export async function keepImage(url) {
  if (typeof url !== 'string' || !url.includes(LOCAL)) return url;
  let u;
  try {
    u = new URL(url, 'http://localhost');
  } catch {
    return url;
  }
  const at = u.pathname.indexOf(LOCAL);
  if (at < 0) return url;
  let objectName;
  try {
    objectName = u.pathname
      .slice(at + LOCAL.length)
      .split('/')
      .map(decodeURIComponent)
      .join('/');
  } catch {
    return url;
  }
  // Only a link the storage itself signed (so the admin could already open it) is copied.
  if (!verifyLocalPresignToken(objectName, u.searchParams.get('token'), u.searchParams.get('exp'))) return url;
  const ext = (objectName.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg');
  if (!IMAGE_TYPES[ext]) return url;
  const name = `${randomUUID()}.${ext}`;
  await storage.copyFile(objectName, PREFIX + name);
  return PUBLIC_BASE + name;
}

/** The stream and type of a stored image, or null for a name that is not one. */
export async function readImage(name) {
  if (!IMAGE_NAME.test(name)) return null;
  const ext = name.split('.').pop();
  return { stream: await storage.getFileStream(PREFIX + name), type: IMAGE_TYPES[ext] };
}
