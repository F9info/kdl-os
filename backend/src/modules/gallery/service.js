import { prisma } from '../../config/database.js';

export const listItems = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';
  return prisma.galleryItem.findMany({ where, orderBy: [{ order: 'asc' }, { created_at: 'asc' }] });
};

export const getItem = (id) => prisma.galleryItem.findUnique({ where: { id } });

export const createItem = (data) => prisma.galleryItem.create({ data });

export const updateItem = async (id, data) => {
  const { count } = await prisma.galleryItem.updateMany({ where: { id }, data });
  return count === 0 ? null : prisma.galleryItem.findUnique({ where: { id } });
};

export const deleteItem = async (id) => {
  const { count } = await prisma.galleryItem.deleteMany({ where: { id } });
  return count > 0;
};
