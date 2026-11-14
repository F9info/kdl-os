import { seedUserManagement } from './seeders/user-management.seed.js';
import { seedTeamUsers } from './seed-team-users.js';
import { seedCoreModules } from './seeders/modules.seed.js';
import { seedBrandKit } from './seeders/brand-kit.seed.js';
import { seedWebsiteContentFields } from './seeders/website-content-fields.seed.js';
import { seedProjects } from '../src/modules/projects/seed.js';
import { seedThemeEngine } from '../src/modules/theme-engine/seed.js';
import { seedCredits } from '../src/modules/credits/seed.js';
import { runSeeders, planSeeders } from '../src/shared/seeders/manager.js';

/**
 * The core seeders, registered with the central seeder manager (src/shared/seeders/manager.js): each has a
 * version and the seeders it needs first, and runs in its own transaction. One registry, two callers:
 * `npm run db:seed` (prisma/seed.js) and the installer's "Core installation" step, so the two cannot drift.
 * Every seeder is idempotent. Bump a seeder's `version` when its output changes (see `--pending`).
 *
 *   createAdmin   runs first (the admin user must exist before roles are assigned)
 *   afterRoles    runs once roles and permissions exist (the installer gives its admin the super-admin role)
 *   onStep        called with ({ name, status: 'running' | 'done' | 'skipped' }) around each seeder, for progress logs
 */
export const CORE_SEEDERS = [
  { name: 'modules', version: '1', description: 'Core module catalogue and permissions', run: (db) => seedCoreModules(db) },
  { name: 'projects', version: '1', description: 'Default project', dependsOn: ['modules'], run: (db) => seedProjects(db) },
  {
    name: 'roles',
    version: '1',
    description: 'Roles, permissions and the Admin / Developer grants',
    dependsOn: ['modules', 'projects'],
    run: async (db, ctx) => {
      await seedUserManagement(db);
      if (ctx.afterRoles) await ctx.afterRoles(db);
    },
  },
  { name: 'team-users', version: '1', description: 'Developer and Admin sign-ins (not in production)', dependsOn: ['roles'], run: (db) => seedTeamUsers(db) },
  { name: 'brand-kit', version: '1', description: 'Default brand kit', dependsOn: ['projects'], run: (db) => seedBrandKit(db) },
  { name: 'website-fields', version: '1', description: 'Website content fields', dependsOn: ['modules'], run: (db) => seedWebsiteContentFields(db) },
  { name: 'theme-engine', version: '1', description: 'Default theme', dependsOn: ['projects'], run: (db) => seedThemeEngine(db) },
  { name: 'credits', version: '1', description: 'Credit rules and balances', dependsOn: ['projects'], run: (db) => seedCredits(db) },
];
export const CORE_SEED_STEPS = CORE_SEEDERS.map((s) => s.name);

/** The seeders for one run: the admin step (if a creator is given) goes first, ahead of everything. */
function registry(createAdmin) {
  if (!createAdmin) return CORE_SEEDERS;
  const admin = { name: 'admin', version: '1', description: 'The Super Admin account', transactional: false, run: () => createAdmin() };
  // 'modules' and everything below wait for the admin, as before.
  return [admin, ...CORE_SEEDERS.map((s) => (s.name === 'modules' ? { ...s, dependsOn: ['admin'] } : s))];
}

export function runCoreSeed(prisma, { createAdmin, afterRoles, onStep, only, pending } = {}) {
  return runSeeders(prisma, registry(createAdmin), { only, pending, onStep, ctx: { afterRoles } });
}

export const planCoreSeed = (prisma, opts = {}) => planSeeders(prisma, registry(opts.createAdmin), opts);
