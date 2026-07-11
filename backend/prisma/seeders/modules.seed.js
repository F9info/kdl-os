import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { manifestSchema } from '../../src/shared/modules/manifest-schema.js';
import { resolvePermissionEntry, permissionModuleLabel } from '../../src/shared/modules/permission-actions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '../../src/modules');

export async function seedCoreModules(prisma) {
  let entries;
  try {
    entries = await readdir(MODULES_DIR, { withFileTypes: true });
  } catch {
    console.log('modules.seed: modules directory not found, skipping');
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(MODULES_DIR, entry.name, 'module.json');
    if (!existsSync(manifestPath)) continue;

    let raw;
    try {
      raw = JSON.parse(await readFile(manifestPath, 'utf8'));
    } catch {
      console.warn(`modules.seed: failed to parse ${manifestPath}, skipping`);
      continue;
    }

    const parsed = manifestSchema.safeParse(raw);
    if (!parsed.success) {
      console.warn(`modules.seed: invalid manifest for "${entry.name}": ${parsed.error.message}`);
      continue;
    }

    const manifest = parsed.data;

    if (!manifest.core) continue;

    // Upsert Module row as ENABLED
    await prisma.module.upsert({
      where: { slug: manifest.slug },
      create: {
        slug: manifest.slug,
        name: manifest.name,
        description: manifest.description ?? null,
        version: manifest.version,
        is_core: true,
        status: 'ENABLED',
        enabled_at: new Date(),
      },
      update: {
        name: manifest.name,
        description: manifest.description ?? null,
        version: manifest.version,
        is_core: true,
        status: 'ENABLED',
      },
    });

    // Register permission modules for this core module (idempotent) — action
    // lists come straight from the manifest, never hardcoded here.
    for (const rawEntry of manifest.permissions ?? []) {
      const { name, actions } = resolvePermissionEntry(rawEntry);
      const label = permissionModuleLabel(name);

      const pm = await prisma.permissionModule.upsert({
        where: { name },
        create: { name, label, is_system: true },
        update: {},
      });

      for (const action of actions) {
        await prisma.permission.upsert({
          where: { module_id_action: { module_id: pm.id, action } },
          create: { module_id: pm.id, action },
          update: {},
        });
      }
    }

    console.log(`modules.seed: registered core module "${manifest.slug}" (ENABLED)`);
  }
}
