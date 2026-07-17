import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { uniqueSlug } from '../../shared/utils/slug.js';

const SORTABLE = ['name', 'created_at', 'is_active'];

const CATEGORY_INCLUDE = { type: { select: { id: true, name: true } } };

// The generic admin API manages only standalone rows (owner_module = null).
// Module-owned rows (e.g. template-engine) must never be mutated or deleted here,
// and generic writes may only reference standalone types.
const WRITABLE = { owner_module: null };

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

// Existence check for generic write paths — resolves only standalone categories.
export const getWritableCategoryById = (id) =>
  prisma.category.findFirst({ where: { id, ...WRITABLE }, include: CATEGORY_INCLUDE });

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
  // Scope the write so module-owned rows can't be mutated; null signals not-found.
  const { count } = await prisma.category.updateMany({ where: { id, ...WRITABLE }, data: updateData });
  if (count === 0) return null;
  return prisma.category.findUnique({ where: { id }, include: CATEGORY_INCLUDE });
};

// Scoped delete — refuses module-owned rows. Returns true only when a row was removed.
export const deleteCategory = async (id) => {
  const { count } = await prisma.category.deleteMany({ where: { id, ...WRITABLE } });
  return count > 0;
};

// Generic writes may only attach categories to standalone types.
export const typeExists = (id) =>
  prisma.type.findFirst({ where: { id, ...WRITABLE }, select: { id: true } });
