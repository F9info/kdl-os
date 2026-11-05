import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as storageService from '../../shared/services/storage.service.js';
import { IDENTITY_KEYS, ASSET_KEYS, KEY_PREFIX } from './schema.js';

export const RAW_CACHE_KEY = 'identity:raw';
export const CACHE_KEY = 'identity:app-config'; // resolved (public) form
// Resolved logo URLs are presigned and expire after 7 days — keep this far below that.
const CACHE_TTL = 300;

const empty = () => Object.fromEntries(IDENTITY_KEYS.map((k) => [k, '']));
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
export const getIdentity = () =>
  cached(RAW_CACHE_KEY, async () => {
    const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: KEY_PREFIX } } });
    const identity = empty();
    for (const { key, value } of rows) {
      const name = key.slice(KEY_PREFIX.length);
      if (IDENTITY_KEYS.includes(name)) identity[name] = value;
    }
    return identity;
  });

// Public form: storage paths resolved to fresh presigned URLs; a failed resolve yields ''.
export const getAppConfig = () =>
  cached(CACHE_KEY, async () => {
    const identity = { ...(await getIdentity()) };
    for (const k of ASSET_KEYS) {
      if (isStoragePath(identity[k])) identity[k] = (await storageService.getFileUrl(identity[k]).catch(() => '')) || '';
    }
    return identity;
  });

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
