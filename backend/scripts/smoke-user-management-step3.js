// Integration smoke test for Step 3 (Roles + Permissions + Activity Log).
// Uses the real dev PostgreSQL database (port 5433) but does NOT require Redis,
// because cache invalidation lives in controllers and is covered by unit tests.
// Run from repository root:
//   node backend/scripts/smoke-user-management-step3.js

import 'dotenv/config';

const { prisma } = await import('../src/config/database.js');
const roleService = await import('../src/modules/user-management/roles/service.js');
const permissionService = await import('../src/modules/user-management/permissions/service.js');
const activityService = await import('../src/modules/user-management/activity/service.js');

const MODULE_NAME = `smoke-module-${Date.now()}`;
const ROLE_NAME = `Smoke Role ${Date.now()}`;

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  // 1. Permission matrix shape
  const matrix = await permissionService.getPermissionMatrix();
  assert(Array.isArray(matrix), 'matrix is an array');
  assert(matrix.length >= 6, 'matrix has at least 6 seeded modules');
  const usersModule = matrix.find((m) => m.name === 'users');
  assert(usersModule, 'users module exists in matrix');
  assert(usersModule.label === 'Users', 'users module label is correct');
  for (const action of ['view', 'add', 'edit', 'delete', 'publish']) {
    assert(typeof usersModule.actions[action] === 'string', `users module action "${action}" has permission id`);
  }
  console.log('✓ permission matrix shape (modules + actions)');

  // 2. Create a permission module -> auto-creates 5 permissions
  const created = await permissionService.createModule({ name: MODULE_NAME, label: 'Smoke Module' });
  assert(created.module.id, 'module created');
  assert(created.permissions.length === 5, 'module has 5 permissions');
  for (const action of ['view', 'add', 'edit', 'delete', 'publish']) {
    assert(created.permissions.some((p) => p.action === action), `permission action "${action}" created`);
  }
  console.log(`✓ created permission module ${created.module.name} with ${created.permissions.length} permissions`);

  // 3. Create a role with a permission subset
  const role = await roleService.createRole({
    name: ROLE_NAME,
    description: 'integration smoke role',
    permission_ids: created.permissions.slice(0, 2).map((p) => p.id),
  });
  assert(role.id, 'role created');
  const roleWithMatrix = await roleService.getRoleById(role.id);
  assert(roleWithMatrix.permission_matrix, 'role includes permission matrix');
  assert(Object.keys(roleWithMatrix.permission_matrix).length === 2, 'role has 2 assigned permissions');
  console.log(`✓ created role "${role.name}" with ${Object.keys(roleWithMatrix.permission_matrix).length} permissions`);

  // 4. Role listing
  const listed = await roleService.listRoles({});
  assert(listed.roles.some((r) => r.id === role.id), 'role appears in paginated list');
  const listedRole = listed.roles.find((r) => r.id === role.id);
  assert(typeof listedRole.user_count === 'number', 'role list includes user_count');
  assert(typeof listedRole.permission_count === 'number', 'role list includes permission_count');
  console.log('✓ role list includes user_count and permission_count');

  // 5. Update role permission set (give+revoke sync)
  const newPermissionIds = created.permissions.slice(2, 4).map((p) => p.id);
  const updated = await roleService.updateRole(role.id, { permission_ids: newPermissionIds });
  assert(Object.keys(updated.permission_matrix).length === 2, 'role permissions synced to new set');
  console.log('✓ role permission sync works');

  // 6. Verify countRoleUsers helper detects assigned users
  const adminRole = await prisma.rbacRole.findUnique({ where: { slug: 'super-admin' } });
  const adminUserCount = await roleService.countRoleUsers(adminRole.id);
  assert(adminUserCount >= 1, 'super-admin role has assigned users');
  console.log('✓ countRoleUsers correctly detects assigned users');

  // 7. Cleanup role
  await roleService.deleteRole(role.id);
  const gone = await roleService.getRoleById(role.id);
  assert(!gone, 'role deleted successfully');
  console.log('✓ role deleted');

  // 8. Cleanup module after references removed
  const refs = await permissionService.countPermissionReferences(created.module.id);
  assert(refs.roles === 0 && refs.users === 0, 'module has no references after role deletion');
  await permissionService.deleteModule(created.module.id);
  const moduleGone = await permissionService.getModuleById(created.module.id);
  assert(!moduleGone, 'module deleted successfully');
  console.log('✓ module deleted');

  // 9. Activity log read-only listing works
  const activity = await activityService.listActivity({ module: 'roles', limit: '10' });
  assert(Array.isArray(activity.logs), 'activity log list returned');
  assert(activity.pagination.total >= 0, 'activity log pagination returned');
  console.log(`✓ activity log list returned ${activity.logs.length} rows`);
}

main()
  .then(async () => {
    console.log('\nAll Step 3 integration smoke assertions passed.');
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
