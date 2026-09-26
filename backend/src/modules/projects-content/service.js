import { prisma } from '../../config/database.js';

export const listCaseStudies = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.projectCaseStudy.findMany({
    where,
    orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
  });
};

export const getCaseStudyById = (id) => prisma.projectCaseStudy.findUnique({ where: { id } });

export const createCaseStudy = (data) => prisma.projectCaseStudy.create({ data });

export const updateCaseStudy = async (id, data) => {
  const { count } = await prisma.projectCaseStudy.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.projectCaseStudy.findUnique({ where: { id } });
};

export const deleteCaseStudy = async (id) => {
  const { count } = await prisma.projectCaseStudy.deleteMany({ where: { id } });
  return count > 0;
};
