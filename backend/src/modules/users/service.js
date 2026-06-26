import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  is_active: true,
  created_at: true,
  updated_at: true,
};

export const listUsers = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where = {};
  if (query.role) where.role = query.role;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  const [users, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, skip, take: limit, orderBy: { created_at: 'desc' } }),
    prisma.user.count({ where }),
  ]);

  return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getUserById = (id) =>
  prisma.user.findUnique({ where: { id }, select: USER_SELECT });

export const updateUser = (id, data) =>
  prisma.user.update({ where: { id }, data, select: USER_SELECT });

export const softDeleteUser = (id) =>
  prisma.user.update({ where: { id }, data: { is_active: false }, select: USER_SELECT });
