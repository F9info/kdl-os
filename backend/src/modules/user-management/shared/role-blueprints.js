// Default permissions of the two working roles. ONE policy, used three ways:
//   - fresh install:      seedUserManagement() calls applyRoleBlueprints()
//   - existing database:  applyBlueprintsOnce() at backend start (marker setting, so a permission an
//                         owner deliberately revokes later is NOT silently granted again)
//   - module installed later: grantForPermissionModule() grants only the NEW module's permissions
//
//   super-admin  owner; bypasses every check (no rows).
//   developer    builds the project: every module (install/enable, products, themes, templates,
//                integrations, content...). Not `roles:delete` or `permissions:delete`.
//   admin        runs the site and people: users, media, settings and all website CONTENT modules.
//                Keeps everything it already had (never narrowed). Cannot install modules, run the
//                template engine, change integrations or design tokens (view only).
//   user         no permissions.

export const ROLE_BLUEPRINT_VERSION = '1';
export const BLUEPRINT_SETTING_KEY = 'rbac.blueprint_version';

export const DEVELOPER = {
  slug: 'developer',
  name: 'Developer',
  description:
    'Builds the project: install and configure modules, products, themes, templates, integrations and content',
};

// Website / business content modules the Admin role manages in full.
const ADMIN_CONTENT_MODULES = new Set([
  'cms',
  'menus',
  'page-builder',
  'landing',
  'forms',
  'team',
  'faq',
  'projects-content',
  'sectors',
  'work',
  'catalog',
  'gallery',
  'testimonials',
  'notifications',
  'collateral',
  'brand-kit',
]);
// The base modules Admin always had (everything except roles:delete).
const ADMIN_BASE_MODULES = new Set([
  'users',
  'roles',
  'settings',
  'activity-log',
  'types',
  'categories',
  'setting-fields',
  'media',
]);
// Admin may look, not change.
const ADMIN_VIEW_ONLY = new Set(['theme-engine', 'template-engine', 'projects']);

// Explicit allow-lists: a module in none of these (modules, integrations, credits, anything new)
// is Developer-only until someone decides otherwise.
export const allowedFor = {
  developer: (module, action) =>
    !(module === 'roles' && action === 'delete') && !(module === 'permissions' && action === 'delete'),
  admin: (module, action) => {
    if (ADMIN_CONTENT_MODULES.has(module)) return true;
    if (ADMIN_VIEW_ONLY.has(module)) return action === 'view';
    if (ADMIN_BASE_MODULES.has(module)) return !(module === 'roles' && action === 'delete');
    return false;
  },
};

const ROLE_SLUGS = Object.keys(allowedFor);

async function roleIds(db) {
  const rows = await db.rbacRole.findMany({
    where: { slug: { in: ROLE_SLUGS } },
    select: { id: true, slug: true },
  });
  return Object.fromEntries(rows.map((r) => [r.slug, r.id]));
}

async function grant(db, permissions, ids) {
  let granted = 0;
  for (const slug of ROLE_SLUGS) {
    if (!ids[slug]) continue;
    const data = permissions
      .filter((p) => allowedFor[slug](p.module.name, p.action))
      .map((p) => ({ role_id: ids[slug], permission_id: p.id }));
    if (data.length === 0) continue;
    const { count } = await db.rolePermission.createMany({ data, skipDuplicates: true });
    granted += count;
  }
  return granted;
}

/** Ensure the developer role exists and grant the blueprint on every permission that exists now. */
export async function applyRoleBlueprints(db) {
  await db.rbacRole.upsert({
    where: { slug: DEVELOPER.slug },
    update: { name: DEVELOPER.name, description: DEVELOPER.description, is_system: true },
    create: { ...DEVELOPER, is_system: true },
  });
  const permissions = await db.permission.findMany({ include: { module: { select: { name: true } } } });
  return grant(db, permissions, await roleIds(db));
}

/** Backend-start hook: apply once per blueprint version. Returns granted count, or null if already applied. */
export async function applyBlueprintsOnce(db) {
  const done = await db.appSetting.findUnique({ where: { key: BLUEPRINT_SETTING_KEY } });
  if (done?.value === ROLE_BLUEPRINT_VERSION) return null;
  const granted = await applyRoleBlueprints(db);
  await db.appSetting.upsert({
    where: { key: BLUEPRINT_SETTING_KEY },
    update: { value: ROLE_BLUEPRINT_VERSION },
    create: {
      key: BLUEPRINT_SETTING_KEY,
      value: ROLE_BLUEPRINT_VERSION,
      type: 'string',
      description: 'Version of the default Developer/Admin role permissions that has been applied',
    },
  });
  return granted;
}

/** Module-install hook: grant just this permission module's rows (call only when it was newly created). */
export async function grantForPermissionModule(db, moduleName) {
  const permissions = await db.permission.findMany({
    where: { module: { name: moduleName } },
    include: { module: { select: { name: true } } },
  });
  return grant(db, permissions, await roleIds(db));
}
