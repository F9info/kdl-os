import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { uniqueSlug } from '../../shared/utils/slug.js';

const SORTABLE = ['name', 'created_at', 'is_active'];

const CATEGORY_INCLUDE = { type: { select: { id: true, name: true } } };

export const listCategories = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where = { owner_module: query.ownerModule ?? null };
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  if (query.type_id) where.type_id = query.type_id;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'created_at';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      include: CATEGORY_INCLUDE,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getCategoryById = (id) =>
  prisma.category.findUnique({ where: { id }, include: CATEGORY_INCLUDE });

export const createCategory = async (data) => {
  const slug = await uniqueSlug(prisma.category, data.name);
  return prisma.category.create({ data: { ...data, slug }, include: CATEGORY_INCLUDE });
};

export const updateCategory = async (id, data) => {
  const updateData = { ...data };
  // Slug is derived from the name, so regenerate it whenever the name changes.
  if (data.name !== undefined) {
    updateData.slug = await uniqueSlug(prisma.category, data.name, id);
  }
  return prisma.category.update({ where: { id }, data: updateData, include: CATEGORY_INCLUDE });
};

export const deleteCategory = (id) => prisma.category.delete({ where: { id } });

export const typeExists = (id) => prisma.type.findUnique({ where: { id }, select: { id: true } });
