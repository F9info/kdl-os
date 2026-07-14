/**
 * KDL-191 gate: on a FRESH database,
 *   B1 — installModule('template-engine') seeds the full catalogue
 *        (86 types / 902 categories / 3910 fields) via the generic seed hook.
 *   B2 — enable → disable → uninstall leaves zero template-engine rows.
 *
 * Run with DATABASE_URL pointing at a freshly migrated, empty database:
 *   DATABASE_URL=... REDIS_URL=... node scripts/kdl191-gate.mjs
 * Exits 0 on pass, 1 on any failed assertion.
 */
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const { prisma } = await import('../src/config/database.js');
const { loadedManifests } = await import('../src/shared/modules/module-loader.js');
const { installModule, enableModule, disableModule, uninstallModule } = await import(
  '../src/modules/modules/service.js'
);

const manifest = JSON.parse(
  await readFile(join(__dirname, '../src/modules/template-engine/module.json'), 'utf8')
);
loadedManifests.set(manifest.slug, manifest);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${actual} (expected ${expected})`);
  if (!ok) failures += 1;
};

const counts = async () => ({
  types: await prisma.type.count(),
  categories: await prisma.category.count(),
  fields: await prisma.settingField.count(),
  values: await prisma.settingValue.count(),
});

// Fresh DB precondition
const before = await counts();
check('fresh DB types', before.types, 0);
check('fresh DB categories', before.categories, 0);
check('fresh DB fields', before.fields, 0);

// B1 — install seeds the catalogue through the generic hook (no manual seed call)
await installModule('template-engine', null);
const after = await counts();
check('post-install types', after.types, 86);
check('post-install categories', after.categories, 902);
check('post-install fields', after.fields, 3910);
check(
  'post-install module row status',
  (await prisma.module.findUnique({ where: { slug: 'template-engine' } }))?.status,
  'INSTALLED'
);
check(
  'spot-check primary button default',
  (await prisma.settingField.findUnique({
    where: { slug: 'webapp.buttons.dark.primary_button.background_color' },
  }))?.value,
  '#4f8ef7'
);

// B2 — enable → disable → uninstall leaves no orphans
await enableModule('template-engine', null);
// Write one override so uninstall also has a SettingValue to cascade away.
const anyField = await prisma.settingField.findUnique({
  where: { slug: 'webapp.buttons.dark.primary_button.background_color' },
});
await prisma.settingValue.create({
  data: { field_id: anyField.id, platform: 'webapp', value: '#123456' },
});
check('override written', (await counts()).values, 1);

await disableModule('template-engine', null);
await uninstallModule('template-engine', null);

const final = await counts();
check('post-uninstall types', final.types, 0);
check('post-uninstall categories', final.categories, 0);
check('post-uninstall fields', final.fields, 0);
check('post-uninstall values', final.values, 0);
check(
  'post-uninstall module row',
  await prisma.module.findUnique({ where: { slug: 'template-engine' } }),
  null
);
check(
  'post-uninstall permission module',
  await prisma.permissionModule.findUnique({ where: { name: 'template-engine' } }),
  null
);

// Reinstall proves uninstall left a cleanly reinstallable state.
await installModule('template-engine', null);
const again = await counts();
check('reinstall types', again.types, 86);
check('reinstall fields', again.fields, 3910);

await prisma.$disconnect();
console.log(failures === 0 ? 'KDL-191 GATE PASS' : `KDL-191 GATE FAIL (${failures} failures)`);
process.exit(failures === 0 ? 0 : 1);
