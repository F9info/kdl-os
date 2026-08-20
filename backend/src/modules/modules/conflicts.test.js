import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));
vi.mock('../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../middleware/module-gate.js', () => ({
  invalidateModuleCache: vi.fn(),
}));

import { prisma } from '../../config/database.js';
import { loadedManifests } from '../../shared/modules/module-loader.js';
import { enableModule, installModule, disableModule, listModules } from './service.js';

vi.mock('../../shared/modules/module-loader.js', () => ({
  loadedManifests: new Map(),
}));

function makeManifest(slug, { conflictsWith = [], dependsOn = [], core = false, name = slug } = {}) {
  return { slug, name, version: '1.0.0', core, dependsOn, conflictsWith, permissions: [], env: [] };
}

// ── Generic conflict scenario (used by KDL-555 tests) ───────────────────────
// mode-studio conflicts with ui-a and ui-b; mirrors the old template-engine
// scenario but keeps the conflict mechanism tests independent of template-engine.
function loadConflictScenarioManifests() {
  loadedManifests.set('mode-studio', makeManifest('mode-studio', {
    name: 'Studio Mode',
    conflictsWith: ['ui-a', 'ui-b'],
    dependsOn: ['engine-x', 'engine-y'],
  }));
  loadedManifests.set('ui-a', makeManifest('ui-a', {
    name: 'UI A',
    conflictsWith: [],
    dependsOn: ['engine-x'],
  }));
  loadedManifests.set('ui-b', makeManifest('ui-b', {
    name: 'UI B',
    conflictsWith: [],
    dependsOn: ['engine-y'],
  }));
  loadedManifests.set('engine-x', makeManifest('engine-x', { name: 'Engine X', core: true }));
  loadedManifests.set('engine-y', makeManifest('engine-y', { name: 'Engine Y', core: true }));
}

// ── Template Engine scenario (no conflicts — KDL-563) ───────────────────────
function loadTemplateEngineManifests() {
  loadedManifests.set('template-engine', makeManifest('template-engine', {
    name: 'Template Engine',
    conflictsWith: [],
    dependsOn: ['theme-engine', 'theme-engine-ui', 'page-builder', 'page-builder-ui', 'brand-kit', 'collateral', 'credits'],
  }));
  loadedManifests.set('theme-engine-ui', makeManifest('theme-engine-ui', {
    name: 'Theme Engine UI',
    conflictsWith: [],
    dependsOn: ['theme-engine'],
  }));
  loadedManifests.set('page-builder-ui', makeManifest('page-builder-ui', {
    name: 'Page Builder UI',
    conflictsWith: [],
    dependsOn: ['page-builder'],
  }));
  loadedManifests.set('theme-engine', makeManifest('theme-engine', { name: 'Theme Engine', core: true }));
  loadedManifests.set('page-builder', makeManifest('page-builder', { name: 'Page Builder', core: true }));
  loadedManifests.set('brand-kit', makeManifest('brand-kit', { name: 'Brand Kit' }));
  loadedManifests.set('collateral', makeManifest('collateral', { name: 'Collateral' }));
  loadedManifests.set('credits', makeManifest('credits', { name: 'Credits' }));
}

// DB rows for the generic conflict scenario
const DB_STUDIO_INSTALLED = { slug: 'mode-studio', name: 'Studio Mode', status: 'INSTALLED', is_core: false, id: 'id-ms' };
const DB_STUDIO_ENABLED = { slug: 'mode-studio', name: 'Studio Mode', status: 'ENABLED', is_core: false, id: 'id-ms' };
const DB_UI_A_ENABLED = { slug: 'ui-a', name: 'UI A', status: 'ENABLED', is_core: false, id: 'id-uia' };
const DB_UI_B_ENABLED = { slug: 'ui-b', name: 'UI B', status: 'ENABLED', is_core: false, id: 'id-uib' };
const DB_ENGINE_X_ENABLED = { slug: 'engine-x', name: 'Engine X', status: 'ENABLED', is_core: true, id: 'id-ex' };
const DB_ENGINE_Y_ENABLED = { slug: 'engine-y', name: 'Engine Y', status: 'ENABLED', is_core: true, id: 'id-ey' };

// DB rows for the template-engine scenario
const DB_TEMPLATE_ENGINE_INSTALLED = { slug: 'template-engine', name: 'Template Engine', status: 'INSTALLED', is_core: false, id: 'id-te' };
const DB_TEMPLATE_ENGINE_ENABLED = { slug: 'template-engine', name: 'Template Engine', status: 'ENABLED', is_core: false, id: 'id-te' };
const DB_THEME_ENGINE_UI_ENABLED = { slug: 'theme-engine-ui', name: 'Theme Engine UI', status: 'ENABLED', is_core: false, id: 'id-teui' };
const DB_PAGE_BUILDER_UI_ENABLED = { slug: 'page-builder-ui', name: 'Page Builder UI', status: 'ENABLED', is_core: false, id: 'id-pbui' };
const DB_THEME_ENGINE_ENABLED = { slug: 'theme-engine', name: 'Theme Engine', status: 'ENABLED', is_core: true, id: 'id-the' };
const DB_PAGE_BUILDER_ENABLED = { slug: 'page-builder', name: 'Page Builder', status: 'ENABLED', is_core: true, id: 'id-pbe' };
const DB_BRAND_KIT_ENABLED = { slug: 'brand-kit', name: 'Brand Kit', status: 'ENABLED', is_core: false, id: 'id-bk' };
const DB_COLLATERAL_ENABLED = { slug: 'collateral', name: 'Collateral', status: 'ENABLED', is_core: false, id: 'id-col' };
const DB_CREDITS_ENABLED = { slug: 'credits', name: 'Credits', status: 'ENABLED', is_core: false, id: 'id-cred' };

beforeEach(() => {
  loadedManifests.clear();
  vi.clearAllMocks();
});

// ── Original tests (backward compat) ────────────────────────────────────────

describe('checkConflicts via enableModule', () => {
  it('fails with 409 when manifest.conflictsWith names an ENABLED module', async () => {
    loadedManifests.set('mod-a', makeManifest('mod-a', { conflictsWith: ['mod-b'] }));
    loadedManifests.set('mod-b', makeManifest('mod-b'));

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-a') return Promise.resolve({ slug: 'mod-a', status: 'INSTALLED', is_core: false });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([{ slug: 'mod-b', name: 'mod-b', status: 'ENABLED', is_core: false }]),
      update: vi.fn(),
    };

    await expect(enableModule('mod-a', 'actor')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('fails with 409 when an ENABLED module\'s conflictsWith names the slug being enabled', async () => {
    loadedManifests.set('mod-a', makeManifest('mod-a'));
    loadedManifests.set('mod-c', makeManifest('mod-c', { conflictsWith: ['mod-a'] }));

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-a') return Promise.resolve({ slug: 'mod-a', status: 'INSTALLED', is_core: false });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([{ slug: 'mod-c', name: 'mod-c', status: 'ENABLED', is_core: false }]),
      update: vi.fn(),
    };

    await expect(enableModule('mod-a', 'actor')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('enables normally when no conflicts are active', async () => {
    loadedManifests.set('mod-x', makeManifest('mod-x', { conflictsWith: ['mod-y'] }));
    loadedManifests.set('mod-y', makeManifest('mod-y'));

    const updated = { slug: 'mod-x', status: 'ENABLED' };
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mod-x') return Promise.resolve({ slug: 'mod-x', status: 'INSTALLED', is_core: false, id: 'id-x' });
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(updated),
    };

    const result = await enableModule('mod-x', 'actor');
    expect(result.status).toBe('ENABLED');
  });
});

// ── KDL-555 tests: conflict mechanism (generic scenario) ────────────────────
// Uses mode-studio / ui-a / ui-b so these tests stay valid after template-engine
// dropped its own conflictsWith (KDL-563).

describe('KDL-555: structured conflict details + resolveConflicts mode switch', () => {
  /**
   * Test 1: enable without resolveConflicts flag when BOTH ui modules are enabled
   * → 409 with details.conflicts listing both ui-a and ui-b
   */
  it('enable without flag → 409 with details.conflicts listing both blocking modules', async () => {
    loadConflictScenarioManifests();

    const depRecord = (slug) => ({ slug, status: 'ENABLED', is_core: false });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mode-studio') return Promise.resolve(DB_STUDIO_INSTALLED);
        return Promise.resolve(depRecord(where.slug));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_UI_A_ENABLED, DB_UI_B_ENABLED,
        DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED,
      ]),
      update: vi.fn(),
    };

    const err = await enableModule('mode-studio', 'actor').catch((e) => e);

    expect(err.status).toBe(409);
    expect(err.details).toBeDefined();
    expect(err.details.code).toBe('MODULE_CONFLICT');

    const conflictSlugs = err.details.conflicts.map((c) => c.slug);
    expect(conflictSlugs).toContain('ui-a');
    expect(conflictSlugs).toContain('ui-b');
    expect(err.details.conflicts.length).toBe(2);
  });

  /**
   * Test 2: with resolveConflicts: true → mode-studio ENABLED,
   * both -ui modules DISABLED; engines remain ENABLED
   */
  it('resolveConflicts: true → atomic switch: target ENABLED, conflicting ui modules DISABLED', async () => {
    loadConflictScenarioManifests();

    const depRecord = (slug, isCore = false) => ({ slug, status: 'ENABLED', is_core: isCore });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mode-studio') return Promise.resolve(DB_STUDIO_INSTALLED);
        const cores = { 'engine-x': true, 'engine-y': true };
        return Promise.resolve(depRecord(where.slug, !!cores[where.slug]));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_UI_A_ENABLED, DB_UI_B_ENABLED,
        DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED,
      ]),
      update: vi.fn(),
    };

    const enabledResult = { slug: 'mode-studio', status: 'ENABLED', id: 'id-ms' };
    prisma.$transaction = vi.fn().mockImplementation(async (fn) => {
      const updates = [];
      const tx = {
        module: {
          update: vi.fn().mockImplementation(({ where, data }) => {
            updates.push({ slug: where.slug, status: data.status });
            if (where.slug === 'mode-studio') return Promise.resolve(enabledResult);
            return Promise.resolve({ slug: where.slug, status: data.status });
          }),
        },
      };
      const result = await fn(tx);
      // Verify: both ui modules disabled before target enabled
      const disabledSlugs = updates.filter((u) => u.status === 'DISABLED').map((u) => u.slug);
      expect(disabledSlugs).toContain('ui-a');
      expect(disabledSlugs).toContain('ui-b');
      return result;
    });

    const result = await enableModule('mode-studio', 'actor', { resolveConflicts: true });
    expect(result.status).toBe('ENABLED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  /**
   * Test 3: symmetric direction — with mode-studio ENABLED, enabling
   * ui-b → 409 (mode-studio's conflictsWith lists it)
   */
  it('symmetric direction: enabling ui-b while mode-studio is ENABLED → 409 with details', async () => {
    loadConflictScenarioManifests();

    const DB_UI_B_INSTALLED = {
      slug: 'ui-b', name: 'UI B', status: 'INSTALLED', is_core: false, id: 'id-uib',
    };

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'ui-b') return Promise.resolve(DB_UI_B_INSTALLED);
        if (where.slug === 'engine-y') return Promise.resolve(DB_ENGINE_Y_ENABLED);
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_STUDIO_ENABLED, DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED,
      ]),
      update: vi.fn(),
    };

    const err = await enableModule('ui-b', 'actor').catch((e) => e);

    expect(err.status).toBe(409);
    expect(err.details).toBeDefined();
    expect(err.details.code).toBe('MODULE_CONFLICT');
    const conflictSlugs = err.details.conflicts.map((c) => c.slug);
    expect(conflictSlugs).toContain('mode-studio');
  });

  /**
   * Test 4: round trip — disable mode-studio → enable ui-b succeeds
   */
  it('round trip: disable mode-studio → enable ui-b succeeds', async () => {
    loadConflictScenarioManifests();

    const DB_UI_B_INSTALLED = {
      slug: 'ui-b', name: 'UI B', status: 'INSTALLED', is_core: false, id: 'id-uib',
    };
    const DB_UI_B_ENABLED_RESULT = {
      slug: 'ui-b', name: 'UI B', status: 'ENABLED', is_core: false, id: 'id-uib',
    };

    // Disable mode-studio first
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mode-studio') return Promise.resolve(DB_STUDIO_ENABLED);
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([DB_STUDIO_ENABLED, DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED]),
      update: vi.fn().mockResolvedValue({ slug: 'mode-studio', status: 'DISABLED' }),
    };

    await disableModule('mode-studio', 'actor');

    // Now enable ui-b (mode-studio is now DISABLED — not in enabled set)
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'ui-b') return Promise.resolve(DB_UI_B_INSTALLED);
        if (where.slug === 'engine-y') return Promise.resolve(DB_ENGINE_Y_ENABLED);
        return Promise.resolve(null);
      }),
      // mode-studio is now DISABLED — absent from ENABLED set
      findMany: vi.fn().mockResolvedValue([DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED]),
      update: vi.fn().mockResolvedValue(DB_UI_B_ENABLED_RESULT),
    };

    const result = await enableModule('ui-b', 'actor');
    expect(result.status).toBe('ENABLED');
  });

  /**
   * Test 5: rollback — $transaction throws mid-switch → target not installed,
   * conflicting modules remain ENABLED
   */
  it('rollback: transaction failure leaves no partial state', async () => {
    loadConflictScenarioManifests();

    const depRecord = (slug) => ({ slug, status: 'ENABLED', is_core: false });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'mode-studio') return Promise.resolve(DB_STUDIO_INSTALLED);
        return Promise.resolve(depRecord(where.slug));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_UI_A_ENABLED, DB_UI_B_ENABLED,
        DB_ENGINE_X_ENABLED, DB_ENGINE_Y_ENABLED,
      ]),
      update: vi.fn(),
    };

    prisma.$transaction = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    const err = await enableModule('mode-studio', 'actor', { resolveConflicts: true }).catch((e) => e);

    // The thrown error propagates — not a 409 status error
    expect(err.message).toMatch(/DB connection lost/);
    // Prisma update was never called directly (all within failed transaction)
    expect(prisma.module.update).not.toHaveBeenCalled();
  });

  /**
   * Test 6: listModules() reports conflicts in both directions (generic scenario)
   * Setup: mode-studio ENABLED; ui-b INSTALLED; ui-a ENABLED
   * - mode-studio.conflicts = [ui-a] (direction 1: own conflictsWith, ui-a is ENABLED)
   * - ui-b.conflicts = [mode-studio] (direction 2: mode-studio lists ui-b and is ENABLED)
   */
  it('listModules() reports conflicts in both directions', async () => {
    loadConflictScenarioManifests();

    const allDbModules = [
      DB_STUDIO_ENABLED,
      { slug: 'ui-b', name: 'UI B', status: 'INSTALLED', is_core: false, id: 'id-uib' },
      DB_UI_A_ENABLED,
      DB_ENGINE_X_ENABLED,
      DB_ENGINE_Y_ENABLED,
    ];

    prisma.module = {
      findMany: vi.fn().mockResolvedValue(allDbModules),
    };

    const modules = await listModules();
    const bySlug = Object.fromEntries(modules.map((m) => [m.slug, m]));

    // Direction 1: mode-studio's own conflictsWith → ui-a is ENABLED
    const studioConflictSlugs = bySlug['mode-studio'].conflicts.map((c) => c.slug);
    expect(studioConflictSlugs).toContain('ui-a');
    // ui-b is INSTALLED (not ENABLED) so does NOT appear in mode-studio.conflicts
    expect(studioConflictSlugs).not.toContain('ui-b');

    // Direction 2: mode-studio (ENABLED) lists ui-b in its conflictsWith
    const uiBConflictSlugs = bySlug['ui-b'].conflicts.map((c) => c.slug);
    expect(uiBConflictSlugs).toContain('mode-studio');

    // Verify conflictsWith field present on manifests
    expect(bySlug['mode-studio'].conflictsWith).toEqual(
      expect.arrayContaining(['ui-a', 'ui-b'])
    );
    expect(bySlug['ui-b'].conflictsWith).toEqual([]);
  });
});

// ── KDL-563: template-engine no longer conflicts ─────────────────────────────

describe('KDL-563: template-engine installs ui modules as dependencies, no conflict', () => {
  it('template-engine manifest has no conflictsWith entries', () => {
    loadTemplateEngineManifests();
    const manifest = loadedManifests.get('template-engine');
    expect(manifest.conflictsWith).toEqual([]);
  });

  it('template-engine dependsOn includes theme-engine-ui and page-builder-ui', () => {
    loadTemplateEngineManifests();
    const manifest = loadedManifests.get('template-engine');
    expect(manifest.dependsOn).toContain('theme-engine-ui');
    expect(manifest.dependsOn).toContain('page-builder-ui');
  });

  it('enabling template-engine succeeds when theme-engine-ui is already ENABLED', async () => {
    loadTemplateEngineManifests();

    const updated = { slug: 'template-engine', status: 'ENABLED', id: 'id-te' };
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'template-engine') return Promise.resolve(DB_TEMPLATE_ENGINE_INSTALLED);
        return Promise.resolve({ slug: where.slug, status: 'ENABLED', is_core: false });
      }),
      // theme-engine-ui and page-builder-ui are ENABLED — no conflict should fire
      findMany: vi.fn().mockResolvedValue([
        DB_THEME_ENGINE_UI_ENABLED, DB_PAGE_BUILDER_UI_ENABLED,
        DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED,
        DB_BRAND_KIT_ENABLED, DB_COLLATERAL_ENABLED, DB_CREDITS_ENABLED,
      ]),
      update: vi.fn().mockResolvedValue(updated),
    };

    const result = await enableModule('template-engine', 'actor');
    expect(result.status).toBe('ENABLED');
  });

  it('listModules() shows template-engine with no active conflicts alongside theme-engine-ui', async () => {
    loadTemplateEngineManifests();

    const allDbModules = [
      DB_TEMPLATE_ENGINE_ENABLED,
      DB_THEME_ENGINE_UI_ENABLED,
      DB_PAGE_BUILDER_UI_ENABLED,
      DB_THEME_ENGINE_ENABLED,
      DB_PAGE_BUILDER_ENABLED,
      DB_BRAND_KIT_ENABLED,
      DB_COLLATERAL_ENABLED,
      DB_CREDITS_ENABLED,
    ];

    prisma.module = {
      findMany: vi.fn().mockResolvedValue(allDbModules),
    };

    const modules = await listModules();
    const bySlug = Object.fromEntries(modules.map((m) => [m.slug, m]));

    expect(bySlug['template-engine'].conflicts).toHaveLength(0);
    expect(bySlug['template-engine'].conflictsWith).toEqual([]);
    // theme-engine-ui is visible alongside template-engine — no suppression
    expect(bySlug['theme-engine-ui']).toBeDefined();
    expect(bySlug['theme-engine-ui'].conflicts).toHaveLength(0);
  });
});

// ── KDL-571: visibleInCatalog flag ────────────────────────────────────────────

describe('KDL-571: visibleInCatalog flag', () => {
  /**
   * Helper that builds a manifest with an optional visibleInCatalog override.
   * When omitted the schema default (true) should apply — we test the explicit
   * false case as returned by listModules().
   */
  function makeManifestWithVisibility(slug, { visibleInCatalog, nav = [], ...rest } = {}) {
    const m = makeManifest(slug, rest);
    m.nav = nav;
    if (visibleInCatalog !== undefined) m.visibleInCatalog = visibleInCatalog;
    return m;
  }

  beforeEach(() => {
    loadedManifests.clear();
    vi.clearAllMocks();
  });

  it('template-engine internal deps report visibleInCatalog: false', async () => {
    // The 4 modules that must be hidden from the catalog
    const hiddenSlugs = ['projects', 'brand-kit', 'collateral', 'credits'];
    for (const slug of hiddenSlugs) {
      loadedManifests.set(slug, makeManifestWithVisibility(slug, { visibleInCatalog: false }));
    }

    // A few modules that should remain visible (no flag → defaults to true)
    loadedManifests.set('template-engine', makeManifestWithVisibility('template-engine'));
    loadedManifests.set('theme-engine', makeManifestWithVisibility('theme-engine'));

    prisma.module = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    const modules = await listModules();
    const bySlug = Object.fromEntries(modules.map((m) => [m.slug, m]));

    for (const slug of hiddenSlugs) {
      expect(bySlug[slug].visibleInCatalog, `${slug} should have visibleInCatalog: false`).toBe(false);
    }

    // Modules without the flag should default to true
    expect(bySlug['template-engine'].visibleInCatalog).toBe(true);
    expect(bySlug['theme-engine'].visibleInCatalog).toBe(true);
  });

  it('modules without visibleInCatalog in manifest default to true', async () => {
    // makeManifest does NOT set visibleInCatalog — the service should default to true
    loadedManifests.set('some-module', makeManifest('some-module'));

    prisma.module = {
      findMany: vi.fn().mockResolvedValue([]),
    };

    const modules = await listModules();
    const mod = modules.find((m) => m.slug === 'some-module');
    expect(mod).toBeDefined();
    expect(mod.visibleInCatalog).toBe(true);
  });

  it('visibleInCatalog: false does NOT affect install/enable/disable — module is still operable', async () => {
    // visibleInCatalog: false on brand-kit should not prevent it from being enabled
    loadedManifests.set('brand-kit', makeManifestWithVisibility('brand-kit', { visibleInCatalog: false }));

    const updated = { slug: 'brand-kit', status: 'ENABLED', id: 'id-bk' };
    prisma.module = {
      findUnique: vi.fn().mockResolvedValue({ slug: 'brand-kit', status: 'INSTALLED', is_core: false, id: 'id-bk' }),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue(updated),
    };

    const result = await enableModule('brand-kit', 'actor');
    expect(result.status).toBe('ENABLED');
  });
});
