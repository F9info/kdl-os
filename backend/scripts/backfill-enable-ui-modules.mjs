/**
 * Backfill: re-enable theme-engine-ui and page-builder-ui when they were
 * left DISABLED (or INSTALLED) by the old KDL-447 conflictsWith mechanic.
 *
 * Context (KDL-616):
 *   KDL-447 made template-engine conflict with theme-engine-ui and
 *   page-builder-ui (conflictsWith). Any site that enabled template-engine
 *   with resolveConflicts=true had those two modules set to DISABLED in the
 *   DB. KDL-563 / KDL-560 removed the conflict (they became dependencies
 *   instead), and KDL-609 removed navSuppressedByPeer from their manifests.
 *   But the live DB still carries the stale DISABLED status — this script
 *   corrects that so both sidebar entries appear again.
 *
 * Guards:
 *   - Only updates modules that exist AND are not already ENABLED.
 *   - Dependency guard: theme-engine-ui depends on theme-engine;
 *     page-builder-ui depends on page-builder. We verify each dep is ENABLED
 *     before flipping the module — if a dep is not ENABLED the module is
 *     skipped with a warning (manual intervention needed).
 *   - Idempotent: safe to re-run.
 *
 * Usage:
 *   node backend/scripts/backfill-enable-ui-modules.mjs [--dry-run]
 */

import { prisma } from '../src/config/database.js';

const DRY_RUN = process.argv.includes('--dry-run');

// Modules to re-enable, each with their hard-coded dependency that must
// already be ENABLED before we flip the module.
const TARGETS = [
  { slug: 'theme-engine-ui', dep: 'theme-engine' },
  { slug: 'page-builder-ui', dep: 'page-builder' },
];

async function main() {
  console.log(`backfill-enable-ui-modules: dry-run=${DRY_RUN}`);

  let fixed = 0;
  let skipped = 0;

  for (const { slug, dep } of TARGETS) {
    const mod = await prisma.module.findUnique({ where: { slug } });

    if (!mod) {
      console.log(`  [SKIP] ${slug}: not installed — nothing to do.`);
      skipped++;
      continue;
    }

    if (mod.status === 'ENABLED') {
      console.log(`  [OK]   ${slug}: already ENABLED — no change needed.`);
      continue;
    }

    // Guard: dep must be ENABLED
    const depMod = await prisma.module.findUnique({ where: { slug: dep } });
    if (depMod?.status !== 'ENABLED') {
      console.warn(
        `  [WARN] ${slug}: dependency "${dep}" is ${depMod?.status ?? 'not installed'}. ` +
        `Enable "${dep}" first, then re-run this script.`
      );
      skipped++;
      continue;
    }

    console.log(`  [${DRY_RUN ? 'DRY' : 'FIX'}] ${slug}: ${mod.status} → ENABLED`);
    if (!DRY_RUN) {
      await prisma.module.update({
        where: { slug },
        data: { status: 'ENABLED', enabled_at: new Date() },
      });
    }
    fixed++;
  }

  console.log(
    `Done. ${fixed} module(s) ${DRY_RUN ? 'would be' : 'were'} re-enabled; ${skipped} skipped.`
  );
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
