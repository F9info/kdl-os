import { prisma } from '../../../config/database.js';
import { getPaginationParams } from '../../../shared/utils/pagination.js';

const ROLE_LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  is_system: true,
  created_at: true,
  updated_at: true,
};

export const listRoles = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const where = {};
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { slug: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [roles, total] = await Promise.all([
    prisma.rbacRole.findMany({
      where,
      select: {
        ...ROLE_LIST_SELECT,
        _count: { select: { users: true, permissions: true } },
      },
      skip,
      take: limit,
      orderBy: { name: 'asc' },
    }),
    prisma.rbacRole.count({ where }),
  ]);

  return {
    roles: roles.map((r) => ({
      ...r,
      user_count: r._count.users,
      permission_count: r._count.permissions,
      _count: undefined,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
};

function toPermissionMatrix(rolePermissions) {
  const permissionIdsByKey = {};
  for (const rp of rolePermissions) {
    const key = `${rp.permission.module.name}:${rp.permission.action}`;
    permissionIdsByKey[key] = rp.permission.id;
  }
  return permissionIdsByKey;
}

export const getRoleById = async (id) => {
  const role = await prisma.rbacRole.findUnique({
    where: { id },
    include: {
      permissions: {
        include: { permission: { include: { module: true } } },
      },
      _count: { select: { users: true } },
    },
  });
  if (!role) return null;
  return {
    ...role,
    user_count: role._count.users,
    permission_matrix: toPermissionMatrix(role.permissions),
    _count: undefined,
  };
};

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const createRole = async ({ name, description, permission_ids }) => {
  const slug = slugify(name);
  return prisma.$transaction(async (tx) => {
    const role = await tx.rbacRole.create({
      data: {
        name,
        slug,
        description: description ?? null,
        permissions: permission_ids.length
          ? { create: permission_ids.map((permission_id) => ({ permission_id })) }
          : undefined,
      },
      include: {
        permissions: {
          include: { permission: { include: { module: true } } },
        },
      },
    });
    return { ...role, permission_matrix: toPermissionMatrix(role.permissions) };
  });
};

export const updateRole = async (id, { name, description, permission_ids }) => {
  const data = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;

  return prisma.$transaction(async (tx) => {
    if (permission_ids !== undefined) {
      await tx.rolePermission.deleteMany({ where: { role_id: id } });
      if (permission_ids.length) {
        await tx.rolePermission.createMany({
          data: permission_ids.map((permission_id) => ({ role_id: id, permission_id })),
          skipDuplicates: true,
        });
      }
    }

    const role = await tx.rbacRole.update({
      where: { id },
      data,
      include: {
        permissions: {
          include: { permission: { include: { module: true } } },
        },
      },
    });
    return { ...role, permission_matrix: toPermissionMatrix(role.permissions) };
  });
};

export const countRoleUsers = (id) => prisma.userRole.count({ where: { role_id: id } });

export const deleteRole = (id) => prisma.$transaction([
  prisma.rolePermission.deleteMany({ where: { role_id: id } }),
  prisma.rbacRole.delete({ where: { id } }),
]);
