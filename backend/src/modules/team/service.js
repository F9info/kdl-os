import { prisma } from '../../config/database.js';

export const listTeamMembers = (query) => {
  const where = {};
  if (query.project_id) where.project_id = query.project_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  return prisma.teamMember.findMany({ where, orderBy: [{ order: 'asc' }, { created_at: 'asc' }] });
};

export const getTeamMemberById = (id) => prisma.teamMember.findUnique({ where: { id } });

export const createTeamMember = (data) => prisma.teamMember.create({ data });

export const updateTeamMember = async (id, data) => {
  const { count } = await prisma.teamMember.updateMany({ where: { id }, data });
  if (count === 0) return null;
  return prisma.teamMember.findUnique({ where: { id } });
};

export const deleteTeamMember = async (id) => {
  const { count } = await prisma.teamMember.deleteMany({ where: { id } });
  return count > 0;
};
