import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database.js';
import { getPaginationParams } from '../../shared/utils/pagination.js';

const SALT_ROUNDS = 12;

const USER_ROLE_SELECT = {
  id: true,
  name: true,
  slug: true,
};

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  is_active: true,
  status: true,
  avatar_media_id: true,
  last_login_at: true,
  deleted_at: true,
  created_at: true,
  updated_at: true,
  roles: {
    select: {
      role: {
        select: USER_ROLE_SELECT,
      },
    },
  },
};

function flattenUser(user) {
  if (!user) return null;
  const { roles: userRoles, ...rest } = user;
  return {
    ...rest,
    roles: Array.isArray(userRoles)
      ? userRoles.map((ur) => ur.role).filter(Boolean)
      : [],
  };
}

export async function listUsers(query) {
  const { page, limit, skip } = getPaginationParams(query);
  const where = { deleted_at: null };

  if (query.status) where.status = query.status;
  if (query.is_active !== undefined) where.is_active = query.is_active === 'true';
  if (query.role) {
    where.roles = {
      some: {
        role: { slug: query.role },
      },
    };
  }
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map(flattenUser),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id, deleted_at: null },
    select: USER_SELECT,
  });
  return flattenUser(user);
}

async function findDefaultUserRole(tx) {
  return tx.rbacRole.findUnique({ where: { slug: 'user' }, select: { id: true } });
}

async function connectUserRoles(tx, userId, roleIds) {
  if (roleIds && roleIds.length > 0) {
    await tx.userRole.createMany({
      data: roleIds.map((role_id) => ({ user_id: userId, role_id })),
      skipDuplicates: true,
    });
    return;
  }

  const defaultRole = await findDefaultUserRole(tx);
  if (defaultRole) {
    await tx.userRole.create({
      data: { user_id: userId, role_id: defaultRole.id },
    });
  }
}

async function syncUserRoles(tx, userId, roleIds) {
  await tx.userRole.deleteMany({ where: { user_id: userId } });
  await connectUserRoles(tx, userId, roleIds ?? []);
}

export async function createUser({ name, email, password, is_active, status, role_ids }) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        email,
        password_hash,
        is_active: is_active ?? true,
        status: status ?? 'ACTIVE',
      },
      select: { id: true },
    });

    await connectUserRoles(tx, user.id, role_ids);

    const created = await tx.user.findUnique({
      where: { id: user.id },
      select: USER_SELECT,
    });

    return flattenUser(created);
  });
}

async function roleIdsIncludeSuperAdmin(roleIds) {
  if (!roleIds || roleIds.length === 0) return false;
  const role = await prisma.rbacRole.findFirst({
    where: { id: { in: roleIds }, slug: 'super-admin' },
    select: { id: true },
  });
  return Boolean(role);
}

export { roleIdsIncludeSuperAdmin };

export async function updateUser(id, data) {
  const { role_ids, ...userData } = data;

  return prisma.$transaction(async (tx) => {
    if (role_ids !== undefined) {
      await syncUserRoles(tx, id, role_ids);
    }

    const user = await tx.user.update({
      where: { id },
      data: userData,
      select: USER_SELECT,
    });

    return flattenUser(user);
  });
}

export function softDeleteUser(id) {
  return prisma.user.update({
    where: { id },
    data: { deleted_at: new Date(), is_active: false },
    select: USER_SELECT,
  });
}

export async function resetPassword(id, password) {
  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: { password_hash },
    }),
    prisma.refreshToken.updateMany({
      where: { user_id: id },
      data: { revoked: true },
    }),
  ]);

  return getUserById(id);
}

export async function updateUserOverrides(id, overrides) {
  return prisma.$transaction(async (tx) => {
    await tx.userPermission.deleteMany({ where: { user_id: id } });

    if (overrides && overrides.length > 0) {
      await tx.userPermission.createMany({
        data: overrides.map(({ permission_id, mode }) => ({
          user_id: id,
          permission_id,
          mode,
        })),
        skipDuplicates: true,
      });
    }

    const user = await tx.user.findUnique({
      where: { id },
      select: {
        ...USER_SELECT,
        permission_overrides: {
          select: {
            permission: { select: { id: true, module_id: true, action: true } },
            mode: true,
          },
        },
      },
    });

    return {
      ...flattenUser(user),
      permission_overrides: user.permission_overrides.map((up) => ({
        permission_id: up.permission.id,
        module_id: up.permission.module_id,
        action: up.permission.action,
        mode: up.mode,
      })),
    };
  });
}

export async function getUserOverrides(id) {
  const result = await prisma.userPermission.findMany({
    where: { user_id: id },
    select: {
      permission: { select: { id: true, module_id: true, action: true } },
      mode: true,
    },
  });
  return result.map((up) => ({
    permission_id: up.permission.id,
    module_id: up.permission.module_id,
    action: up.permission.action,
    mode: up.mode,
  }));
}

export async function getUserRoleSlugs(userId) {
  const userRoles = await prisma.userRole.findMany({
    where: { user_id: userId },
    select: { role: { select: { slug: true } } },
  });
  return userRoles.map((ur) => ur.role.slug);
}
