#!/usr/bin/env node
/**
 * Finish the website setup on an installation that completed the installer before it did this itself
 * (before 2026-11-21): enable the modules of the chosen type (the website builder included), run the
 * Studio with its defaults (palette from the logo, fonts, layout, menu pages) and build the public site.
 * Safe to run again: finished steps are skipped. Changes nothing for a type without a website.
 *
 * Usage (production):
 *   docker compose -f docker-compose.yml -f docker-compose.prod.yml exec backend node scripts/studio-defaults.js
 * Usage (local):
 *   docker compose exec backend node scripts/studio-defaults.js
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';
import { redis } from '../src/config/redis.js';
import { isInstalled } from '../src/shared/install/status.js';
import { applyType, currentType } from '../src/shared/install/service.js';
import { hasFrontend } from '../src/shared/install/app-types.js';
import { completeStudioDefaults } from '../src/shared/install/studio-defaults.js';
import { buildSite } from '../src/modules/template-engine/site/generator.js';
import { getDefaultProjectId } from '../src/shared/default-project.js';
import { loadManifestsOnly } from '../src/shared/modules/module-loader.js';

async function main() {
  await loadManifestsOnly(); // the module list the installer uses (the server fills it at start)
  if (!(await isInstalled())) {
    console.log('The installer has not finished yet. Complete it at /install first.');
    return 1;
  }
  const type = (await currentType())?.type;
  if (!hasFrontend(type)) {
    console.log(`Application type "${type ?? 'none'}" has no website. Nothing to do.`);
    return 0;
  }
  const modules = await applyType(type);
  console.log(`Modules for "${type}" enabled: ${modules.join(', ')}`);
  const r = await completeStudioDefaults({ log: (m) => console.log(m) });
  console.log(`Studio: ${r.status}${r.steps.length ? ` (${r.steps.join(', ')})` : ''}${r.reason ? ` - ${r.reason}` : ''}`);
  const site = await buildSite(await getDefaultProjectId(prisma));
  console.log(`Website built: ${site.slug} - ${site.pages} pages. Restart site-preview to serve it.`);
  return 0;
}

main()
  .then((code) => (process.exitCode = code))
  .catch((e) => {
    console.error(`Failed: ${e.code ? `${e.code} ` : ''}${e.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
    await redis.quit?.().catch(() => {});
    setTimeout(() => process.exit(process.exitCode ?? 0), 500).unref();
  });
