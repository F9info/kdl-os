import { redis } from '../config/redis.js';
import { errorResponse } from '../shared/utils/response.js';

const MODULE_CACHE_TTL = 60; // seconds

export async function getModuleStatus(slug) {
  try {
    const cached = await redis.get(`module:status:${slug}`);
    if (cached !== null) return cached === '' ? null : cached;
  } catch {
    // Redis unavailable — fall through to DB
  }

  const { prisma } = await import('../config/database.js');
  const mod = await prisma.module.findUnique({ where: { slug }, select: { status: true } });
  const status = mod?.status ?? null;

  try {
    // Cache null (module not in DB) as empty string so repeat lookups skip the DB.
    await redis.set(`module:status:${slug}`, status ?? '', 'EX', MODULE_CACHE_TTL);
  } catch {
    // Redis unavailable — skip cache write
  }
  return status;
}

export async function invalidateModuleCache(slug) {
  await redis.del(`module:status:${slug}`);
}

export function moduleGate(slug) {
  return async (req, res, next) => {
    try {
      const status = await getModuleStatus(slug);
      if (status !== 'ENABLED') {
        return errorResponse(res, 'Not found', 404);
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
