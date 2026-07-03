import { prisma } from '../../../config/database.js';
import { getPaginationParams } from '../../../shared/utils/pagination.js';

export const listActivity = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where = {};

  if (query.actor) where.actor_id = query.actor;
  if (query.module) where.module = { contains: query.module, mode: 'insensitive' };

  const range = {};
  if (query.from) range.gte = new Date(query.from);
  if (query.to) range.lte = new Date(query.to);
  if (Object.keys(range).length) where.created_at = range;

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      select: {
        id: true,
        module: true,
        action: true,
        subject_type: true,
        subject_id: true,
        description: true,
        properties: true,
        ip_address: true,
        created_at: true,
        actor: { select: { id: true, name: true, email: true } },
      },
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return {
    logs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};
