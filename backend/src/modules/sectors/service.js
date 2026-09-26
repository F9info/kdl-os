import { prisma } from '../../config/database.js';

export const listSectors = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.sector.findMany({
    where,
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
};

export const getSectorById = (id) => prisma.sector.findUnique({ where: { id } });

export const createSector = (data) => prisma.sector.create({ data });

export const updateSector = async (id, data) => {
  const { count } = await prisma.sector.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.sector.findUnique({ where: { id } });
};

export const deleteSector = async (id) => {
  const { count } = await prisma.sector.deleteMany({ where: { id } });
  return count > 0;
};
