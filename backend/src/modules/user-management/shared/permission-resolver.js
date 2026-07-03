import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';

const CACHE_PREFIX = 'perm:user:';
const CACHE_TTL_SECONDS = 600;

const cacheKey = (userId) => `${CACHE_PREFIX}${userId}`;

async function fetchEffectivePermissions(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, deleted_at: true },
  });

  if (!user || user.status !== 'ACTIVE' || user.deleted_at) {
    return { bypass: false, permissions: [] };
  }

  const userRoles = await prisma.userRole.findMany({
    where: { user_id: userId },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: { include: { module: true } },
            },
          },
        },
      },
    },
  });

  // Super Admin bypasses all permission checks — no need to enumerate permissions.
  if (userRoles.some((ur) => ur.role.slug === 'super-admin')) {
    return { bypass: true, permissions: [] };
  }

  const overrides = await prisma.userPermission.findMany({
    where: { user_id: userId },
    include: {
      permission: { include: { module: true } },
    },
  });

  const permissions = new Set();

  for (const ur of userRoles) {
    for (const rp of ur.role.permissions) {
      permissions.add(`${rp.permission.module.name}:${rp.permission.action}`);
    }
  }

  for (const up of overrides) {
    const key = `${up.permission.module.name}:${up.permission.action}`;
    if (up.mode === 'GRANT') {
      permissions.add(key);
    } else if (up.mode === 'DENY') {
      permissions.delete(key);
    }
  }

  return { bypass: false, permissions: Array.from(permissions) };
}

/**
 * Resolve the effective RBAC permission set for a user.
 *
 * Result shape:
 *   { bypass: true,  permissions: [] } // super-admin — all access
 *   { bypass: false, permissions: ['module:action', ...] }
 *
 * Results are cached in Redis for 10 minutes.
 */
export async function resolvePermissions(userId) {
  if (!userId) {
    return { bypass: false, permissions: [] };
  }

  const cached = await redis.get(cacheKey(userId));
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // Corrupt cache entry; fall through to DB and overwrite.
    }
  }

  const result = await fetchEffectivePermissions(userId);
  await redis.setex(cacheKey(userId), CACHE_TTL_SECONDS, JSON.stringify(result));
  return result;
}

/**
 * Check whether a user has a specific permission.
 */
export async function hasPermission(userId, moduleName, action) {
  const result = await resolvePermissions(userId);
  if (result.bypass) return true;
  return result.permissions.includes(`${moduleName}:${action}`);
}

/**
 * Invalidate all cached permission sets.
 *
 * Uses SCAN, never KEYS, per CLAUDE.md rule.
 */
export async function invalidatePermissionCache(pattern = `${CACHE_PREFIX}*`) {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    if (keys.length) {
      await redis.del(...keys);
    }
    cursor = nextCursor;
  } while (cursor !== '0');
}
