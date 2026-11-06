import { describe, it, expect, vi } from 'vitest';
import {
  allowedFor,
  applyRoleBlueprints,
  applyBlueprintsOnce,
  grantForPermissionModule,
  BLUEPRINT_SETTING_KEY,
  ROLE_BLUEPRINT_VERSION,
} from './role-blueprints.js';

const ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'];
const can = (role, m, a) => allowedFor[role](m, a);

describe('blueprint policy', () => {
  it('developer gets every module except roles:delete and permissions:delete', () => {
    for (const m of [
      'modules',
      'integrations',
      'template-engine',
      'theme-engine',
      'cms',
      'page-builder',
      'credits',
      'brand-new-module',
    ])
      for (const a of ACTIONS) expect(can('developer', m, a), `${m}:${a}`).toBe(true);
    expect(can('developer', 'roles', 'delete')).toBe(false);
    expect(can('developer', 'permissions', 'delete')).toBe(false);
    expect(can('developer', 'permissions', 'edit')).toBe(true);
  });

  it('admin manages website content and people in full', () => {
    for (const m of [
      'cms',
      'menus',
      'page-builder',
      'landing',
      'forms',
      'faq',
      'team',
      'media',
      'users',
      'settings',
      'notifications',
    ])
      for (const a of ACTIONS) expect(can('admin', m, a), `${m}:${a}`).toBe(true);
  });

  it('admin only LOOKS at design/engine/projects and cannot install, integrate or touch credits', () => {
    for (const m of ['theme-engine', 'template-engine', 'projects']) {
      expect(can('admin', m, 'view')).toBe(true);
      for (const a of ['add', 'edit', 'delete', 'publish'])
        expect(can('admin', m, a), `${m}:${a}`).toBe(false);
    }
    for (const m of ['modules', 'integrations', 'credits'])
      for (const a of ACTIONS) expect(can('admin', m, a), `${m}:${a}`).toBe(false);
  });

  it('admin keeps its original limits and never gets a module nobody decided on', () => {
    expect(can('admin', 'roles', 'delete')).toBe(false);
    expect(can('admin', 'roles', 'edit')).toBe(true);
    for (const a of ACTIONS) expect(can('admin', 'permissions', a)).toBe(false);
    expect(can('admin', 'brand-new-module', 'view')).toBe(false); // default-deny
  });
});

// A tiny in-memory stand-in for the Prisma calls the blueprint uses.
function fakeDb({ marker = null } = {}) {
  const roles = [{ id: 'r-admin', slug: 'admin' }];
  const permissions = [
    { id: 'p1', action: 'view', module: { name: 'cms' } },
    { id: 'p2', action: 'add', module: { name: 'modules' } },
    { id: 'p3', action: 'delete', module: { name: 'roles' } },
  ];
  const grants = [];
  const settings = new Map(marker ? [[BLUEPRINT_SETTING_KEY, { value: marker }]] : []);
  return {
    grants,
    settings,
    roles,
    rbacRole: {
      upsert: vi.fn(async ({ where, create }) => {
        if (!roles.find((r) => r.slug === where.slug))
          roles.push({ id: `r-${where.slug}`, slug: where.slug, ...create });
      }),
      findMany: vi.fn(async () => roles),
    },
    permission: {
      findMany: vi.fn(async ({ where } = {}) =>
        permissions.filter((p) => !where?.module?.name || p.module.name === where.module.name)
      ),
    },
    rolePermission: {
      createMany: vi.fn(async ({ data }) => {
        let count = 0;
        for (const d of data) {
          if (!grants.find((g) => g.role_id === d.role_id && g.permission_id === d.permission_id)) {
            grants.push(d);
            count++;
          }
        }
        return { count };
      }),
    },
    appSetting: {
      findUnique: vi.fn(async ({ where }) => settings.get(where.key) ?? null),
      upsert: vi.fn(async ({ where, create }) => settings.set(where.key, create)),
    },
  };
}

describe('applying the blueprint', () => {
  it('creates the developer role and grants per policy, idempotently', async () => {
    const db = fakeDb();
    const first = await applyRoleBlueprints(db);
    expect(db.roles.map((r) => r.slug).sort()).toEqual(['admin', 'developer']);
    // developer: cms:view, modules:add (roles:delete excluded) = 2; admin: cms:view = 1
    expect(first).toBe(3);
    expect(
      db.grants
        .filter((g) => g.role_id === 'r-developer')
        .map((g) => g.permission_id)
        .sort()
    ).toEqual(['p1', 'p2']);
    expect(db.grants.filter((g) => g.role_id === 'r-admin').map((g) => g.permission_id)).toEqual(['p1']);
    expect(await applyRoleBlueprints(db)).toBe(0);
  });

  it('applyBlueprintsOnce runs once, then respects the marker (revocations stay revoked)', async () => {
    const db = fakeDb();
    expect(await applyBlueprintsOnce(db)).toBe(3);
    expect(db.settings.get(BLUEPRINT_SETTING_KEY).value).toBe(ROLE_BLUEPRINT_VERSION);
    db.grants.length = 0; // owner revokes everything
    expect(await applyBlueprintsOnce(db)).toBeNull();
    expect(db.grants).toHaveLength(0);
  });

  it('grantForPermissionModule grants only that module', async () => {
    const db = fakeDb();
    await db.rbacRole.upsert({ where: { slug: 'developer' }, create: {} });
    await grantForPermissionModule(db, 'modules');
    expect(db.grants.map((g) => g.permission_id)).toEqual(['p2']); // developer only; admin denied
  });
});
