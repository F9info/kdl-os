import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';
import { uniqueSlug } from '../../shared/utils/slug.js';

const SORTABLE = ['name', 'created_at', 'is_active'];

// The generic admin API manages only standalone rows (owner_module = null).
// Rows stamped with an owner_module belong to that module (e.g. template-engine)
// and must never be read-for-write, mutated, or deleted through this API even
// when their id is known.
const WRITABLE = { owner_module: null };

export const listTypes = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);

  const where = { owner_module: query.ownerModule ?? null };
  if (query.search) where.name = { contains: query.search, mode: 'insensitive' };
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';

  const sortBy = SORTABLE.includes(query.sortBy) ? query.sortBy : 'created_at';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';

  const [types, total] = await Promise.all([
    prisma.type.findMany({ where, skip, take: limit, orderBy: { [sortBy]: sortOrder } }),
    prisma.type.count({ where }),
  ]);

  return { types, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

export const getTypeById = (id) => prisma.type.findUnique({ where: { id } });

// Existence check for generic write paths — resolves only standalone types.
export const getWritableTypeById = (id) =>
  prisma.type.findFirst({ where: { id, ...WRITABLE } });

export const createType = async (data) => {
  const slug = await uniqueSlug(prisma.type, data.name);
  return prisma.type.create({ data: { ...data, slug } });
};

export const updateType = async (id, data) => {
  const updateData = { ...data };
  // Slug is derived from the name, so regenerate it whenever the name changes.
  if (data.name !== undefined) {
    updateData.slug = await uniqueSlug(prisma.type, data.name, id);
  }
  // Scope the write so module-owned rows can't be mutated; null signals not-found.
  const { count } = await prisma.type.updateMany({ where: { id, ...WRITABLE }, data: updateData });
  if (count === 0) return null;
  return prisma.type.findUnique({ where: { id } });
};

// Count records that depend on this Type, so deletion can be blocked while any exist.
export const getTypeDependents = async (id) => {
  const [fields, categories] = await Promise.all([
    prisma.settingField.count({ where: { type_id: id } }),
    prisma.category.count({ where: { type_id: id } }),
  ]);
  return { fields, categories };
};

// Scoped delete — refuses module-owned rows. Returns true only when a row was removed.
export const deleteType = async (id) => {
  const { count } = await prisma.type.deleteMany({ where: { id, ...WRITABLE } });
  return count > 0;
};
