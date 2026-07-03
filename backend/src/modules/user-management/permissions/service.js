import { prisma } from '../../../config/database.js';

const ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'];

export const getPermissionMatrix = async () => {
  const modules = await prisma.permissionModule.findMany({
    include: { permissions: { orderBy: { action: 'asc' } } },
    orderBy: [{ is_system: 'desc' }, { sort_order: 'asc' }],
  });

  return modules.map((module) => {
    const actions = {};
    for (const permission of module.permissions) {
      actions[permission.action] = permission.id;
    }
    const { permissions, ...rest } = module;
    return { ...rest, actions };
  });
};

function normalizeName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const createModule = async ({ name, label, sort_order = 0 }) => {
  const normalizedName = normalizeName(name);
  return prisma.$transaction(async (tx) => {
    const module = await tx.permissionModule.create({
      data: { name: normalizedName, label, sort_order },
      include: { permissions: true },
    });

    await tx.permission.createMany({
      data: ACTIONS.map((action) => ({ module_id: module.id, action })),
      skipDuplicates: true,
    });

    const permissions = await tx.permission.findMany({ where: { module_id: module.id } });

    return { module, permissions };
  });
};

export const getModuleById = (id) =>
  prisma.permissionModule.findUnique({
    where: { id },
    include: { permissions: { orderBy: { action: 'asc' } } },
  });

export const updateModule = async (id, { name, label, sort_order }) => {
  const data = {};
  if (name !== undefined) data.name = normalizeName(name);
  if (label !== undefined) data.label = label;
  if (sort_order !== undefined) data.sort_order = sort_order;

  return prisma.permissionModule.update({
    where: { id },
    data,
    include: { permissions: { orderBy: { action: 'asc' } } },
  });
};

export const countPermissionReferences = async (moduleId) => {
  const permissionIds = (
    await prisma.permission.findMany({ where: { module_id: moduleId }, select: { id: true } })
  ).map((p) => p.id);

  if (!permissionIds.length) return { roles: 0, users: 0 };

  const [roles, users] = await Promise.all([
    prisma.rolePermission.count({ where: { permission_id: { in: permissionIds } } }),
    prisma.userPermission.count({ where: { permission_id: { in: permissionIds } } }),
  ]);
  return { roles, users };
};

export const deleteModule = async (id) => {
  return prisma.$transaction([
    prisma.rolePermission.deleteMany({
      where: { permission: { module_id: id } },
    }),
    prisma.userPermission.deleteMany({
      where: { permission: { module_id: id } },
    }),
    prisma.permission.deleteMany({ where: { module_id: id } }),
    prisma.permissionModule.delete({ where: { id } }),
  ]);
};
