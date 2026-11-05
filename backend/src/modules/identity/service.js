import { randomUUID } from 'node:crypto';
import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as storageService from '../../shared/services/storage.service.js';
import { IDENTITY_KEYS, ASSET_KEYS, KEY_PREFIX } from './schema.js';
import { readIdentity } from './read.js';

export const RAW_CACHE_KEY = 'identity:raw';
export const CACHE_KEY = 'identity:app-config'; // resolved (public) form
// Resolved logo URLs are presigned and expire after 7 days — keep this far below that.
const CACHE_TTL = 300;

const isStoragePath = (v) => v && !/^https?:\/\//i.test(v) && !v.startsWith('/');

async function cached(key, load) {
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit);
  } catch {
    // Redis unavailable — fall through
  }
  const value = await load();
  try {
    await redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL);
  } catch {
    // skip cache write
  }
  return value;
}

// Stored values as-is (storage paths for assets). Used by the admin API so edits round-trip.
// Whitelist by construction: only IDENTITY_KEYS are returned, so stray `identity.*` rows
// in app_settings can never leak.
export const getIdentity = () => cached(RAW_CACHE_KEY, () => readIdentity());

// Public form: storage paths resolved to fresh presigned URLs; a failed resolve yields ''.
export async function resolveAssetUrls(source) {
  const identity = { ...source };
  for (const k of ASSET_KEYS) {
    if (isStoragePath(identity[k])) identity[k] = (await storageService.getFileUrl(identity[k]).catch(() => '')) || '';
  }
  return identity;
}

export const getAppConfig = () => cached(CACHE_KEY, async () => resolveAssetUrls(await getIdentity()));

export async function updateIdentity(patch) {
  const entries = Object.entries(patch).filter(([k]) => IDENTITY_KEYS.includes(k));
  await prisma.$transaction(
    entries.map(([k, value]) =>
      prisma.appSetting.upsert({
        where: { key: KEY_PREFIX + k },
        update: { value },
        create: { key: KEY_PREFIX + k, value, type: 'string', description: `Application identity: ${k}`, is_public: false },
      })
    )
  );
  try {
    await redis.del(RAW_CACHE_KEY, CACHE_KEY);
  } catch {
    // caches expire via TTL
  }
  return getIdentity();
}

// Logo/favicon upload. Images only (no SVG: served from the storage origin, it could run script)
// and capped at 2 MB. Returns the storage path to save plus a preview URL.
const ASSET_TYPES = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;

// The company logo goes through the brand kit when that module is on: it sanitizes SVG, makes the
// raster the colour palette is built from, and (setGlobalLogo) writes the stored path back into
// Identity. One upload, one logo everywhere. Without the brand kit it is a plain image upload.
async function uploadLogoViaBrandKit(file, userId) {
  const [{ getModuleStatus }, { getDefaultProjectId }, brandKit] = await Promise.all([
    import('../../middleware/module-gate.js'),
    import('../../shared/default-project.js'),
    import('../brand-kit/service.js'),
  ]);
  if ((await getModuleStatus('brand-kit')) !== 'ENABLED') return null;
  const projectId = await getDefaultProjectId();
  if (!projectId) return null;
  await brandKit.uploadLogo(projectId, file, userId);
  await redis.del(RAW_CACHE_KEY, CACHE_KEY).catch(() => {});
  const { logo_light: path } = await getIdentity();
  return path ? { path, url: await storageService.getFileUrl(path) } : null;
}

export async function uploadAsset(file, { asset, userId } = {}) {
  if (asset === 'logo_light') {
    const viaKit = await uploadLogoViaBrandKit(file, userId);
    if (viaKit) return viaKit;
  }
  const ext = ASSET_TYPES[file.mimetype];
  if (!ext) throw Object.assign(new Error('Upload a PNG, JPEG, WebP, GIF or ICO image'), { status: 400 });
  if (file.size > MAX_ASSET_BYTES) throw Object.assign(new Error('Image must be 2 MB or smaller'), { status: 400 });
  const path = `identity/${randomUUID()}.${ext}`;
  await storageService.uploadFile(file, path);
  return { path, url: await storageService.getFileUrl(path) };
}
