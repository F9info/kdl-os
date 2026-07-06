import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { invalidateModuleCache } from '../../middleware/module-gate.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

function checkEnvVars(manifest) {
  const missing = (manifest.env ?? []).filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const err = new Error(`Missing required env vars: ${missing.join(', ')}`);
    err.status = 422;
    throw err;
  }
}

async function registerPermissions(manifest) {
  const ACTIONS = ['view', 'add', 'edit', 'delete', 'publish'];
  for (const name of manifest.permissions ?? []) {
    const label = name
      .split(/[-_]/)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');

    const pm = await prisma.permissionModule.upsert({
      where: { name },
      create: { name, label, is_system: false },
      update: {},
    });

    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { module_id_action: { module_id: pm.id, action } },
        create: { module_id: pm.id, action },
        update: {},
      });
    }
  }
}

async function deregisterPermissions(manifest) {
  for (const name of manifest.permissions ?? []) {
    const pm = await prisma.permissionModule.findUnique({ where: { name } });
    if (!pm) continue;

    const refCount = await prisma.rolePermission.count({
      where: { permission: { module_id: pm.id } },
    });
    const userRefCount = await prisma.userPermission.count({
      where: { permission: { module_id: pm.id } },
    });

    if (refCount > 0 || userRefCount > 0) {
      const err = new Error(
        `Cannot uninstall "${manifest.slug}": permission module "${name}" is still referenced by roles or users`
      );
      err.status = 409;
      throw err;
    }

    await prisma.permissionModule.delete({ where: { id: pm.id } });
  }
}

// ── Public lifecycle operations ──────────────────────────────────────────────

export async function installModule(slug, actorId) {
  const manifest = loadedManifests.get(slug);
  if (!manifest) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  const existing = await prisma.module.findUnique({ where: { slug } });
  if (existing) {
    const err = new Error(`Module "${slug}" is already installed`);
    err.status = 409;
    throw err;
  }

  // Check dependsOn modules are available (at least INSTALLED)
  for (const dep of manifest.dependsOn ?? []) {
    const depMod = await prisma.module.findUnique({ where: { slug: dep } });
    if (!depMod) {
      const err = new Error(`Dependency "${dep}" is not installed`);
      err.status = 409;
      throw err;
    }
  }

  checkEnvVars(manifest);
  await registerPermissions(manifest);

  const mod = await prisma.module.create({
    data: {
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description ?? null,
      version: manifest.version,
      is_core: manifest.core ?? false,
      status: 'INSTALLED',
    },
  });

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'installed',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" installed`,
  });

  return mod;
}

export async function enableModule(slug, actorId) {
  const mod = await prisma.module.findUnique({ where: { slug } });
  if (!mod) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  if (mod.status === 'ENABLED') {
    const err = new Error(`Module "${slug}" is already enabled`);
    err.status = 409;
    throw err;
  }

  const manifest = loadedManifests.get(slug);
  for (const dep of manifest?.dependsOn ?? []) {
    const depMod = await prisma.module.findUnique({ where: { slug: dep } });
    if (depMod?.status !== 'ENABLED') {
      const err = new Error(`Dependency "${dep}" must be ENABLED before enabling "${slug}"`);
      err.status = 409;
      throw err;
    }
  }

  const updated = await prisma.module.update({
    where: { slug },
    data: { status: 'ENABLED', enabled_at: new Date() },
  });

  await invalidateModuleCache(slug);

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'enabled',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" enabled`,
  });

  return updated;
}

export async function disableModule(slug, actorId) {
  const mod = await prisma.module.findUnique({ where: { slug } });
  if (!mod) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  if (mod.is_core) {
    const err = new Error(`Core module "${slug}" cannot be disabled`);
    err.status = 409;
    throw err;
  }

  if (mod.status !== 'ENABLED') {
    const err = new Error(`Module "${slug}" is not currently enabled`);
    err.status = 409;
    throw err;
  }

  // Check no other ENABLED module depends on this one
  const allEnabled = await prisma.module.findMany({ where: { status: 'ENABLED' } });
  const dependents = allEnabled.filter((m) => {
    const mf = loadedManifests.get(m.slug);
    return mf?.dependsOn?.includes(slug);
  });

  if (dependents.length > 0) {
    const names = dependents.map((m) => m.slug).join(', ');
    const err = new Error(`Cannot disable "${slug}": modules [${names}] depend on it`);
    err.status = 409;
    throw err;
  }

  const updated = await prisma.module.update({
    where: { slug },
    data: { status: 'DISABLED' },
  });

  await invalidateModuleCache(slug);

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'disabled',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" disabled`,
  });

  return updated;
}

export async function uninstallModule(slug, actorId) {
  const mod = await prisma.module.findUnique({ where: { slug } });
  if (!mod) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  if (mod.is_core) {
    const err = new Error(`Core module "${slug}" cannot be uninstalled`);
    err.status = 409;
    throw err;
  }

  if (mod.status !== 'DISABLED') {
    const err = new Error(`Module "${slug}" must be DISABLED before uninstalling`);
    err.status = 409;
    throw err;
  }

  const manifest = loadedManifests.get(slug);
  if (manifest) await deregisterPermissions(manifest);

  await prisma.module.delete({ where: { slug } });

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'uninstalled',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" uninstalled (tables retained)`,
  });
}

export async function patchModuleSettings(slug, settings, actorId) {
  const mod = await prisma.module.findUnique({ where: { slug } });
  if (!mod) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  const updated = await prisma.module.update({
    where: { slug },
    data: { settings: { ...(mod.settings ?? {}), ...settings } },
  });

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'settings_updated',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" settings updated`,
  });

  return updated;
}

export async function listModules() {
  const dbModules = await prisma.module.findMany({ orderBy: { name: 'asc' } });
  const dbBySlug = new Map(dbModules.map((m) => [m.slug, m]));

  // Merge manifest-only (AVAILABLE) with DB rows
  const results = [];

  for (const [slug, manifest] of loadedManifests) {
    const dbMod = dbBySlug.get(slug);
    results.push({
      slug,
      name: manifest.name,
      description: manifest.description ?? null,
      version: manifest.version,
      core: manifest.core ?? false,
      apiPrefix: manifest.apiPrefix,
      status: dbMod?.status ?? 'AVAILABLE',
      installed_at: dbMod?.installed_at ?? null,
      enabled_at: dbMod?.enabled_at ?? null,
      settings: dbMod?.settings ?? null,
    });
  }

  // Also include DB rows whose manifest is no longer on disk (orphaned)
  for (const [slug, dbMod] of dbBySlug) {
    if (!loadedManifests.has(slug)) {
      results.push({ ...dbMod, status: dbMod.status, _orphaned: true });
    }
  }

  return results;
}

export async function listEnabledModules() {
  const dbModules = await prisma.module.findMany({ where: { status: 'ENABLED' } });
  return dbModules.map((m) => {
    const manifest = loadedManifests.get(m.slug);
    return {
      slug: m.slug,
      name: m.name,
      nav: manifest?.nav ?? [],
    };
  });
}
