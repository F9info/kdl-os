import { prisma } from '../../config/database.js';
import { IDENTITY_KEYS, KEY_PREFIX } from './schema.js';

const empty = () => Object.fromEntries(IDENTITY_KEYS.map((k) => [k, '']));

/**
 * Stored Application Identity values straight from app_settings (no cache). Whitelist by
 * construction: only IDENTITY_KEYS are returned, so stray `identity.*` rows can never leak.
 * Shared by the identity service (which adds a cache) and by consumers that only need the values
 * (website seed, print layouts) and must not depend on Redis.
 */
export async function readIdentity(client = prisma) {
  const rows = await client.appSetting.findMany({ where: { key: { startsWith: KEY_PREFIX } } });
  const identity = empty();
  for (const { key, value } of rows) {
    const name = key.slice(KEY_PREFIX.length);
    if (IDENTITY_KEYS.includes(name)) identity[name] = value;
  }
  return identity;
}
