import { applyBlueprintsOnce } from '../../src/modules/user-management/shared/role-blueprints.js';

// User Management RBAC system data (USER_MANAGEMENT_ARCH.md → Seeder).
// Every block is upsert-safe: re-running the seeder never duplicates rows.

// 'media' is deliberately absent — its permissions are per-feature and
// registered from backend/src/modules/media/module.json by seedCoreModules,
// which must run before this seeder (see prisma/seed.js ordering).
const MODULES = [
  { name: 'users', label: 'Users' },
  { name: 'roles', label: 'Roles' },
  { name: 'permissions', label: 'Permissions' },
  { name: 'settings', label: 'Settings' },
  { name: 'activity-log', label: 'Activity Log' },
  { name: 'types', label: 'Types' },
  { name: 'categories', label: 'Categories' },
  { name: 'setting-fields', label: 'Setting Fields' },
];

const ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'];

const ROLES = [
  {
    name: 'Super Admin',
    slug: 'super-admin',
    description: 'Full access — bypasses all permission checks in middleware',
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'All module actions except role deletion and permission management',
  },
  {
    name: 'User',
    slug: 'user',
    description: 'Standard user — app-level features only',
  },
  {
    name: 'Media Sharer',
    slug: 'media-sharer',
    description: 'Can share and approve media assets (media:share + media:approve)',
  },
];

export async function seedUserManagement(prisma) {
  // System modules, each with all 5 action permissions
  const permIdByKey = new Map(); // "module:action" -> permission id
  for (const [i, m] of MODULES.entries()) {
    const module = await prisma.permissionModule.upsert({
      where: { name: m.name },
      update: { label: m.label, is_system: true, sort_order: i },
      create: { name: m.name, label: m.label, is_system: true, sort_order: i },
    });
    for (const action of ACTIONS) {
      const permission = await prisma.permission.upsert({
        where: { module_id_action: { module_id: module.id, action } },
        update: {},
        create: { module_id: module.id, action },
      });
      permIdByKey.set(`${m.name}:${action}`, permission.id);
    }
  }

  // Media's permission rows come from its manifest (seedCoreModules, run
  // before this) — pull them in so Admin still gets full media access.
  const mediaModule = await prisma.permissionModule.findUnique({ where: { name: 'media' } });
  if (mediaModule) {
    const mediaPermissions = await prisma.permission.findMany({ where: { module_id: mediaModule.id } });
    for (const permission of mediaPermissions) {
      permIdByKey.set(`media:${permission.action}`, permission.id);
    }
  }

  // System roles
  const roleBySlug = {};
  for (const r of ROLES) {
    roleBySlug[r.slug] = await prisma.rbacRole.upsert({
      where: { slug: r.slug },
      update: { is_system: true }, // a renamed system role keeps its name
      create: { ...r, is_system: true },
    });
  }

  // Super Admin: middleware bypass — no permission rows.
  // User: no permissions.
  // Admin: all actions on all modules EXCEPT roles:delete and permissions:*
  const adminPermissionIds = [...permIdByKey.entries()]
    .filter(([key]) => key !== 'roles:delete' && !key.startsWith('permissions:'))
    .map(([, id]) => id);
  for (const permission_id of adminPermissionIds) {
    await prisma.rolePermission.upsert({
      where: {
        role_id_permission_id: { role_id: roleBySlug.admin.id, permission_id },
      },
      update: {},
      create: { role_id: roleBySlug.admin.id, permission_id },
    });
  }

  // Media Sharer: media:share + media:approve only
  const mediaSharerPermKeys = ['media:share', 'media:approve'];
  for (const key of mediaSharerPermKeys) {
    const permId = permIdByKey.get(key);
    if (permId) {
      await prisma.rolePermission.upsert({
        where: {
          role_id_permission_id: { role_id: roleBySlug['media-sharer'].id, permission_id: permId },
        },
        update: {},
        create: { role_id: roleBySlug['media-sharer'].id, permission_id: permId },
      });
    }
  }

  // Developer role + the default Developer/Admin grants for every module registered so far
  // (later module installs grant their own; see role-blueprints.js).
  const blueprintGrants = await applyBlueprintsOnce(prisma);

  // The seeded admin user (SEED_ADMIN_EMAIL, default admin@kdl.com) gets super-admin
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@kdl.com';
  const adminUser = await prisma.user.findUnique({
    where: { email: adminEmail },
  });
  if (adminUser) {
    await prisma.userRole.upsert({
      where: {
        user_id_role_id: {
          user_id: adminUser.id,
          role_id: roleBySlug['super-admin'].id,
        },
      },
      update: {},
      create: { user_id: adminUser.id, role_id: roleBySlug['super-admin'].id },
    });
  }

  console.log(
    `Seeded RBAC: ${MODULES.length + (mediaModule ? 1 : 0)} modules, ${permIdByKey.size} permissions, ` +
      `${ROLES.length} roles (admin role: ${adminPermissionIds.length} base permissions` +
      `${blueprintGrants === null ? ', blueprint already applied' : `, +${blueprintGrants} blueprint grants`})` +
      (adminUser ? `, ${adminEmail} → super-admin` : ''),
  );
}
