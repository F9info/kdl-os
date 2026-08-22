import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { invalidateModuleCache } from '../../middleware/module-gate.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';
import { resolvePermissionEntry, permissionModuleLabel } from '../../shared/modules/permission-actions.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '..');

/**
 * Compute which ENABLED modules currently block `slug` from being enabled.
 * Checks both directions: own manifest's conflictsWith AND other manifests
 * that list this slug. Pure function — DB results must be supplied.
 */
function computeBlockingConflicts(slug, manifest, allEnabledModules) {
  const enabledBySlug = new Map(allEnabledModules.map((m) => [m.slug, m]));
  const blockers = new Map();

  // Direction 1: this manifest lists a currently-enabled slug as a conflict
  for (const blocker of manifest.conflictsWith ?? []) {
    if (enabledBySlug.has(blocker)) {
      const bf = loadedManifests.get(blocker);
      const dbMod = enabledBySlug.get(blocker);
      blockers.set(blocker, { slug: blocker, name: bf?.name ?? dbMod?.name ?? blocker, status: 'ENABLED' });
    }
  }

  // Direction 2: another enabled manifest lists this slug as a conflict
  for (const [mSlug, mf] of loadedManifests) {
    if (mSlug === slug) continue;
    if ((mf.conflictsWith ?? []).includes(slug) && enabledBySlug.has(mSlug)) {
      blockers.set(mSlug, { slug: mSlug, name: mf.name ?? mSlug, status: 'ENABLED' });
    }
  }

  return [...blockers.values()];
}

function throwConflictError(slug, blockingConflicts) {
  const names = blockingConflicts.map((c) => `"${c.slug}"`).join(', ');
  const err = new Error(`Cannot enable "${slug}": conflicts with active modules: ${names}`);
  err.status = 409;
  err.details = {
    code: 'MODULE_CONFLICT',
    conflicts: blockingConflicts.map((c) => ({ slug: c.slug, name: c.name })),
  };
  throw err;
}

/**
 * Validate that each conflict slug can safely be disabled in a mode switch.
 * Guards mirror disableModule: refuse if core, refuse if a non-switching
 * ENABLED module depends on it.
 */
function validateModeSwitchGuards(blockingConflicts, allEnabledModules) {
  const conflictSlugs = new Set(blockingConflicts.map((c) => c.slug));

  for (const conflict of blockingConflicts) {
    const conflictMod = allEnabledModules.find((m) => m.slug === conflict.slug);

    if (conflictMod?.is_core) {
      const err = new Error(`Cannot disable core module "${conflict.slug}" as part of mode switch`);
      err.status = 409;
      throw err;
    }

    const dependents = allEnabledModules.filter((m) => {
      if (conflictSlugs.has(m.slug)) return false;
      const mf = loadedManifests.get(m.slug);
      return mf?.dependsOn?.includes(conflict.slug);
    });

    if (dependents.length > 0) {
      const names = dependents.map((m) => m.slug).join(', ');
      const err = new Error(`Cannot disable "${conflict.slug}" as part of mode switch: modules [${names}] depend on it`);
      err.status = 409;
      throw err;
    }
  }
}

function checkEnvVars(manifest) {
  const missing = (manifest.env ?? []).filter((key) => !process.env[key]);
  if (missing.length > 0) {
    const err = new Error(`Missing required env vars: ${missing.join(', ')}`);
    err.status = 422;
    throw err;
  }
}

async function registerPermissions(manifest, tx = prisma) {
  for (const entry of manifest.permissions ?? []) {
    const { name, actions } = resolvePermissionEntry(entry);
    const label = permissionModuleLabel(name);

    const pm = await tx.permissionModule.upsert({
      where: { name },
      create: { name, label, is_system: false },
      update: {},
    });

    for (const action of actions) {
      await tx.permission.upsert({
        where: { module_id_action: { module_id: pm.id, action } },
        create: { module_id: pm.id, action },
        update: {},
      });
    }
  }
}

async function deregisterPermissions(manifest, tx = prisma) {
  for (const entry of manifest.permissions ?? []) {
    const { name } = resolvePermissionEntry(entry);
    const pm = await tx.permissionModule.findUnique({ where: { name } });
    if (!pm) continue;

    const refCount = await tx.rolePermission.count({
      where: { permission: { module_id: pm.id } },
    });
    const userRefCount = await tx.userPermission.count({
      where: { permission: { module_id: pm.id } },
    });

    if (refCount > 0 || userRefCount > 0) {
      const err = new Error(
        `Cannot uninstall "${manifest.slug}": permission module "${name}" is still referenced by roles or users`
      );
      err.status = 409;
      throw err;
    }

    await tx.permissionModule.delete({ where: { id: pm.id } });
  }
}

// ── Public lifecycle operations ──────────────────────────────────────────────

// DFS topological sort — returns slugs in dependency-first install order.
// Throws 404 for unknown slugs, 409 for cycles.
function buildInstallOrder(slug, order = [], visiting = new Set(), done = new Set()) {
  if (done.has(slug)) return order;
  if (visiting.has(slug)) {
    const err = new Error(`Circular dependency detected involving "${slug}"`);
    err.status = 409;
    throw err;
  }

  const manifest = loadedManifests.get(slug);
  if (!manifest) {
    const err = new Error(`Module "${slug}" not found`);
    err.status = 404;
    throw err;
  }

  visiting.add(slug);
  for (const dep of manifest.dependsOn ?? []) {
    buildInstallOrder(dep, order, visiting, done);
  }
  visiting.delete(slug);
  done.add(slug);
  order.push(slug);
  return order;
}

// Install exactly one module. Caller must ensure deps are already installed.
async function _installSingle(slug, actorId, { resolveConflicts = false } = {}) {
  const manifest = loadedManifests.get(slug);

  const allEnabled = await prisma.module.findMany({ where: { status: 'ENABLED' } });
  const blockingConflicts = computeBlockingConflicts(slug, manifest, allEnabled);

  if (blockingConflicts.length > 0) {
    if (!resolveConflicts) throwConflictError(slug, blockingConflicts);
    validateModeSwitchGuards(blockingConflicts, allEnabled);
  }

  checkEnvVars(manifest);

  // H3: resolve the module seed before opening the transaction. The seed must
  // be the default export (or a `seed*`-named export) — grabbing the first
  // function in namespace order silently ran the wrong helper (KDL-191 B1).
  let seedFn = null;
  const seedPath = join(MODULES_DIR, slug, 'seed.js');
  if (existsSync(seedPath)) {
    const seedMod = await import(seedPath);
    seedFn =
      seedMod.default ??
      Object.entries(seedMod).find(([name, v]) => typeof v === 'function' && name.startsWith('seed'))?.[1];
    if (typeof seedFn !== 'function') {
      const err = new Error(`Module "${slug}" seed.js has no default or seed* function export`);
      err.status = 422;
      throw err;
    }
  }

  let mod;
  try {
    mod = await prisma.$transaction(
      async (tx) => {
        // When resolving conflicts atomically, disable blockers first
        for (const conflict of blockingConflicts) {
          await tx.module.update({ where: { slug: conflict.slug }, data: { status: 'DISABLED' } });
        }

        await registerPermissions(manifest, tx);

        // Seed runs on the transaction client so a failed install leaves no
        // orphaned catalogue rows (idempotent; errors abort the transaction).
        if (seedFn) await seedFn(tx);

        return tx.module.create({
          data: {
            slug: manifest.slug,
            name: manifest.name,
            description: manifest.description ?? null,
            version: manifest.version,
            is_core: manifest.core ?? false,
            status: 'INSTALLED',
          },
        });
      },
      // Module seeds can write thousands of rows — Prisma's 5s default is too small.
      { timeout: 180_000, maxWait: 10_000 }
    );
  } catch (err) {
    if (err.code === 'P2002') {
      const e = new Error(`Module "${slug}" is already installed`);
      e.status = 409;
      throw e;
    }
    throw err;
  }

  await invalidateModuleCache(slug);
  for (const conflict of blockingConflicts) {
    await invalidateModuleCache(conflict.slug);
  }

  if (blockingConflicts.length > 0) {
    writeActivityAsync({
      actor: actorId,
      module: 'user-management/modules',
      action: 'mode_switched',
      subject_type: 'Module',
      subject_id: mod.id,
      description: `Mode switched: "${slug}" installed, disabled [${blockingConflicts.map((c) => c.slug).join(', ')}]`,
    });
  } else {
    writeActivityAsync({
      actor: actorId,
      module: 'user-management/modules',
      action: 'installed',
      subject_type: 'Module',
      subject_id: mod.id,
      description: `Module "${slug}" installed`,
    });
  }

  return mod;
}

export async function installModule(slug, actorId, { resolveConflicts = false } = {}) {
  // Build full transitive install order (throws 404 for unknown slugs, 409 on cycle)
  const installOrder = buildInstallOrder(slug);

  // Preserve existing 409 if the target itself is already installed. Checked
  // per-slug (not a batch findMany) so each dep's own install state is read
  // fresh right before we decide whether to install it — a batch check taken
  // once up front raced with `_installSingle`'s effects and, for a module that
  // depends on something already installed, re-created that dependency's row
  // (P2002 double-create — KDL-568).
  if (await prisma.module.findUnique({ where: { slug } })) {
    const err = new Error(`Module "${slug}" is already installed`);
    err.status = 409;
    throw err;
  }

  // Auto-install every missing dep in topological order (target is last element)
  const installedDependencies = [];
  for (const depSlug of installOrder.slice(0, -1)) {
    const existingDep = await prisma.module.findUnique({ where: { slug: depSlug } });
    if (existingDep) continue;
    await _installSingle(depSlug, actorId, { resolveConflicts });
    installedDependencies.push(depSlug);
  }

  // Install the target itself
  const mod = await _installSingle(slug, actorId, { resolveConflicts });

  // Return shape stays the bare module (KDL-542 contract) — installedDependencies
  // rides along as a side-channel field rather than nesting the module under
  // `.module`, which silently broke every existing caller/test expecting the
  // bare object.
  return { ...mod, installedDependencies };
}

export async function enableModule(slug, actorId, { resolveConflicts = false } = {}) {
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
  if (!manifest) {
    const err = new Error(`Manifest for "${slug}" is not loaded — cannot verify dependencies before enabling`);
    err.status = 500;
    throw err;
  }
  for (const dep of manifest.dependsOn ?? []) {
    const depMod = await prisma.module.findUnique({ where: { slug: dep } });
    if (depMod?.status !== 'ENABLED') {
      const err = new Error(`Dependency "${dep}" must be ENABLED before enabling "${slug}"`);
      err.status = 409;
      throw err;
    }
  }

  // Fetch all currently-enabled modules once for both conflict detection and guard checks
  const allEnabled = await prisma.module.findMany({ where: { status: 'ENABLED' } });
  const blockingConflicts = manifest ? computeBlockingConflicts(slug, manifest, allEnabled) : [];

  if (blockingConflicts.length > 0) {
    if (!resolveConflicts) throwConflictError(slug, blockingConflicts);
    validateModeSwitchGuards(blockingConflicts, allEnabled);
  }

  let updated;
  if (blockingConflicts.length > 0) {
    updated = await prisma.$transaction(async (tx) => {
      for (const conflict of blockingConflicts) {
        await tx.module.update({ where: { slug: conflict.slug }, data: { status: 'DISABLED' } });
      }
      return tx.module.update({ where: { slug }, data: { status: 'ENABLED', enabled_at: new Date() } });
    });

    await invalidateModuleCache(slug);
    for (const conflict of blockingConflicts) {
      await invalidateModuleCache(conflict.slug);
    }

    writeActivityAsync({
      actor: actorId,
      module: 'user-management/modules',
      action: 'mode_switched',
      subject_type: 'Module',
      subject_id: mod.id,
      description: `Mode switched: "${slug}" enabled, disabled [${blockingConflicts.map((c) => c.slug).join(', ')}]`,
    });
  } else {
    updated = await prisma.module.update({
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
  }

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

  if (mod.status === 'ENABLED') {
    const err = new Error(`Module "${slug}" must be disabled before uninstalling`);
    err.status = 409;
    throw err;
  }

  // Optional per-module cleanup hook: modules that seed shared tables ship an
  // uninstall.js default export that removes their rows (KDL-191 B2).
  let uninstallFn = null;
  const uninstallPath = join(MODULES_DIR, slug, 'uninstall.js');
  if (existsSync(uninstallPath)) {
    const uninstallMod = await import(uninstallPath);
    uninstallFn = uninstallMod.default;
    if (typeof uninstallFn !== 'function') {
      const err = new Error(`Module "${slug}" uninstall.js has no default function export`);
      err.status = 422;
      throw err;
    }
  }

  await prisma.$transaction(
    async (tx) => {
      const manifest = loadedManifests.get(slug);
      if (manifest) await deregisterPermissions(manifest, tx);
      if (uninstallFn) await uninstallFn(tx);
      await tx.module.delete({ where: { slug } });
    },
    { timeout: 180_000, maxWait: 10_000 }
  );

  await invalidateModuleCache(slug);

  writeActivityAsync({
    actor: actorId,
    module: 'user-management/modules',
    action: 'uninstalled',
    subject_type: 'Module',
    subject_id: mod.id,
    description: `Module "${slug}" uninstalled${uninstallFn ? ' (module data removed)' : ' (tables retained)'}`,
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

  const enabledModules = dbModules.filter((m) => m.status === 'ENABLED');

  // Merge manifest-only (AVAILABLE) with DB rows
  const results = [];

  for (const [slug, manifest] of loadedManifests) {
    const dbMod = dbBySlug.get(slug);
    const conflicts = computeBlockingConflicts(slug, manifest, enabledModules);

    results.push({
      slug,
      name: manifest.name,
      description: manifest.description ?? null,
      version: manifest.version,
      core: manifest.core ?? false,
      visibleInCatalog: manifest.visibleInCatalog !== false,
      apiPrefix: manifest.apiPrefix,
      icon: manifest.nav?.[0]?.icon ?? null,
      status: dbMod?.status ?? 'AVAILABLE',
      installed_at: dbMod?.installed_at ?? null,
      enabled_at: dbMod?.enabled_at ?? null,
      settings: dbMod?.settings ?? null,
      conflictsWith: manifest.conflictsWith ?? [],
      conflicts,
    });
  }

  // Also include DB rows whose manifest is no longer on disk (orphaned)
  for (const [slug, dbMod] of dbBySlug) {
    if (!loadedManifests.has(slug)) {
      results.push({ ...dbMod, status: dbMod.status, _orphaned: true, conflictsWith: [], conflicts: [] });
    }
  }

  return results;
}

export async function listEnabledModules() {
  const dbModules = await prisma.module.findMany({ where: { status: 'ENABLED' } });
  const enabledSlugs = new Set(dbModules.map((m) => m.slug));
  return dbModules.map((m) => {
    const manifest = loadedManifests.get(m.slug);
    const navSuppressed = (manifest?.navSuppressedByPeer ?? []).some((peer) => enabledSlugs.has(peer));
    return {
      slug: m.slug,
      name: m.name,
      core: manifest?.core ?? false,
      nav: navSuppressed ? [] : (manifest?.nav ?? []),
    };
  });
}
