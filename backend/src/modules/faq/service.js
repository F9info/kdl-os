import { prisma } from '../../config/database.js';

export const listFaqs = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.faqEntry.findMany({ where, orderBy: [{ order: 'asc' }, { created_at: 'asc' }] });
};

export const getFaqById = (id) => prisma.faqEntry.findUnique({ where: { id } });

export const createFaq = (data) => prisma.faqEntry.create({ data });

export const updateFaq = async (id, data) => {
  const { count } = await prisma.faqEntry.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.faqEntry.findUnique({ where: { id } });
};

export const deleteFaq = async (id) => {
  const { count } = await prisma.faqEntry.deleteMany({ where: { id } });
  return count > 0;
};
