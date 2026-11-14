import { prisma } from '../../config/database.js';
import { readRuns } from '../../shared/seeders/manager.js';
import { listModules } from './service.js';

/**
 * What the admin dashboard shows about the platform, in one read-only call: how many modules are on (by group),
 * the application type chosen at install, the latest result of every seeder, and the website / landing pages.
 * Everything comes from the module manifests, the module table, the seeder run record and the sites table.
 */
export async function platformOverview() {
  const [mods, runs, type, landing] = await Promise.all([
    listModules(),
    readRuns(prisma),
    prisma.appSetting.findUnique({ where: { key: 'install.app_type' } }),
    prisma.site.count({ where: { type: 'LANDING' } }),
  ]);
  const real = mods.filter((m) => !m._orphaned);
  const enabled = real.filter((m) => m.status === 'ENABLED');
  const groups = new Map();
  for (const m of real) {
    const g = groups.get(m.group) ?? { group: m.group, enabled: 0, total: 0 };
    g.total += 1;
    if (m.status === 'ENABLED') g.enabled += 1;
    groups.set(m.group, g);
  }
  const seeders = Object.entries(runs).map(([name, r]) => ({ name, ...r }));
  const failed = seeders.filter((s) => s.status === 'failed');
  const last = seeders.map((s) => s.at).filter(Boolean).sort().pop() ?? null;
  return {
    app_type: type?.value ?? null,
    modules: {
      total: real.length,
      enabled: enabled.length,
      installed: real.filter((m) => m.status === 'INSTALLED' || m.status === 'DISABLED').length,
      available: real.filter((m) => m.status === 'AVAILABLE').length,
      by_group: [...groups.values()].sort((a, b) => a.group.localeCompare(b.group)),
    },
    seeders: {
      total: seeders.length,
      done: seeders.filter((s) => s.status === 'done').length,
      failed: failed.map((s) => ({ name: s.name, error: s.error ?? '', at: s.at })),
      last_run_at: last,
    },
    website: {
      enabled: enabled.some((m) => m.slug === 'cms'),
      landing_pages: landing,
    },
  };
}
