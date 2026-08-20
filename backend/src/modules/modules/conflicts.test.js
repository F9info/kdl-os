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

// ── Manifests used across template-engine scenario tests ────────────────────
function loadTemplateEngineManifests() {
  loadedManifests.set('template-engine', makeManifest('template-engine', {
    name: 'Template Engine',
    conflictsWith: ['theme-engine-ui', 'page-builder-ui'],
    dependsOn: ['theme-engine', 'page-builder', 'brand-kit', 'collateral', 'credits'],
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

// ── New tests for KDL-555 ────────────────────────────────────────────────────

describe('KDL-555: structured conflict details + resolveConflicts mode switch', () => {
  /**
   * Test 1: enable without resolveConflicts flag when BOTH ui modules are enabled
   * → 409 with details.conflicts listing both page-builder-ui and theme-engine-ui
   */
  it('enable without flag → 409 with details.conflicts listing both blocking modules', async () => {
    loadTemplateEngineManifests();

    const depRecord = (slug) => ({ slug, status: 'ENABLED', is_core: false });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'template-engine') return Promise.resolve(DB_TEMPLATE_ENGINE_INSTALLED);
        return Promise.resolve(depRecord(where.slug));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_THEME_ENGINE_UI_ENABLED, DB_PAGE_BUILDER_UI_ENABLED,
        DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED,
        DB_BRAND_KIT_ENABLED, DB_COLLATERAL_ENABLED, DB_CREDITS_ENABLED,
      ]),
      update: vi.fn(),
    };

    const err = await enableModule('template-engine', 'actor').catch((e) => e);

    expect(err.status).toBe(409);
    expect(err.details).toBeDefined();
    expect(err.details.code).toBe('MODULE_CONFLICT');

    const conflictSlugs = err.details.conflicts.map((c) => c.slug);
    expect(conflictSlugs).toContain('theme-engine-ui');
    expect(conflictSlugs).toContain('page-builder-ui');
    expect(err.details.conflicts.length).toBe(2);
  });

  /**
   * Test 2: with resolveConflicts: true → template-engine ENABLED,
   * both -ui modules DISABLED; page-builder + theme-engine remain ENABLED
   */
  it('resolveConflicts: true → atomic switch: target ENABLED, conflicting -ui modules DISABLED', async () => {
    loadTemplateEngineManifests();

    const depRecord = (slug, isCore = false) => ({ slug, status: 'ENABLED', is_core: isCore });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'template-engine') return Promise.resolve(DB_TEMPLATE_ENGINE_INSTALLED);
        const cores = { 'theme-engine': true, 'page-builder': true };
        return Promise.resolve(depRecord(where.slug, !!cores[where.slug]));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_THEME_ENGINE_UI_ENABLED, DB_PAGE_BUILDER_UI_ENABLED,
        DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED,
        DB_BRAND_KIT_ENABLED, DB_COLLATERAL_ENABLED, DB_CREDITS_ENABLED,
      ]),
      update: vi.fn(),
    };

    const enabledResult = { slug: 'template-engine', status: 'ENABLED', id: 'id-te' };
    prisma.$transaction = vi.fn().mockImplementation(async (fn) => {
      const updates = [];
      const tx = {
        module: {
          update: vi.fn().mockImplementation(({ where, data }) => {
            updates.push({ slug: where.slug, status: data.status });
            if (where.slug === 'template-engine') return Promise.resolve(enabledResult);
            return Promise.resolve({ slug: where.slug, status: data.status });
          }),
        },
      };
      const result = await fn(tx);
      // Verify: both -ui modules disabled before target enabled
      const disabledSlugs = updates.filter((u) => u.status === 'DISABLED').map((u) => u.slug);
      expect(disabledSlugs).toContain('theme-engine-ui');
      expect(disabledSlugs).toContain('page-builder-ui');
      return result;
    });

    const result = await enableModule('template-engine', 'actor', { resolveConflicts: true });
    expect(result.status).toBe('ENABLED');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  /**
   * Test 3: symmetric direction — with template-engine ENABLED, enabling
   * page-builder-ui → 409 (template-engine's conflictsWith lists it)
   */
  it('symmetric direction: enabling page-builder-ui while template-engine is ENABLED → 409 with details', async () => {
    loadTemplateEngineManifests();

    const DB_PAGE_BUILDER_UI_INSTALLED = {
      slug: 'page-builder-ui', name: 'Page Builder UI', status: 'INSTALLED', is_core: false, id: 'id-pbui',
    };

    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'page-builder-ui') return Promise.resolve(DB_PAGE_BUILDER_UI_INSTALLED);
        if (where.slug === 'page-builder') return Promise.resolve(DB_PAGE_BUILDER_ENABLED);
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_TEMPLATE_ENGINE_ENABLED, DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED,
        DB_BRAND_KIT_ENABLED, DB_COLLATERAL_ENABLED, DB_CREDITS_ENABLED,
      ]),
      update: vi.fn(),
    };

    const err = await enableModule('page-builder-ui', 'actor').catch((e) => e);

    expect(err.status).toBe(409);
    expect(err.details).toBeDefined();
    expect(err.details.code).toBe('MODULE_CONFLICT');
    const conflictSlugs = err.details.conflicts.map((c) => c.slug);
    expect(conflictSlugs).toContain('template-engine');
  });

  /**
   * Test 4: round trip — disable template-engine → enable page-builder-ui succeeds
   */
  it('round trip: disable template-engine → enable page-builder-ui succeeds', async () => {
    loadTemplateEngineManifests();

    const DB_PAGE_BUILDER_UI_INSTALLED = {
      slug: 'page-builder-ui', name: 'Page Builder UI', status: 'INSTALLED', is_core: false, id: 'id-pbui',
    };
    const DB_PAGE_BUILDER_UI_ENABLED = {
      slug: 'page-builder-ui', name: 'Page Builder UI', status: 'ENABLED', is_core: false, id: 'id-pbui',
    };

    // Disable template-engine first
    const DB_TE_ENABLED = { ...DB_TEMPLATE_ENGINE_ENABLED };
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'template-engine') return Promise.resolve(DB_TE_ENABLED);
        return Promise.resolve(null);
      }),
      findMany: vi.fn().mockResolvedValue([DB_TEMPLATE_ENGINE_ENABLED, DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED]),
      update: vi.fn().mockResolvedValue({ slug: 'template-engine', status: 'DISABLED' }),
    };

    await disableModule('template-engine', 'actor');

    // Now enable page-builder-ui (template-engine is now DISABLED — not in enabled set)
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'page-builder-ui') return Promise.resolve(DB_PAGE_BUILDER_UI_INSTALLED);
        if (where.slug === 'page-builder') return Promise.resolve(DB_PAGE_BUILDER_ENABLED);
        return Promise.resolve(null);
      }),
      // template-engine is now DISABLED — absent from ENABLED set
      findMany: vi.fn().mockResolvedValue([DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED]),
      update: vi.fn().mockResolvedValue(DB_PAGE_BUILDER_UI_ENABLED),
    };

    const result = await enableModule('page-builder-ui', 'actor');
    expect(result.status).toBe('ENABLED');
  });

  /**
   * Test 5: rollback — $transaction throws mid-switch → target not installed,
   * conflicting modules remain ENABLED
   */
  it('rollback: transaction failure leaves no partial state', async () => {
    loadTemplateEngineManifests();

    const depRecord = (slug) => ({ slug, status: 'ENABLED', is_core: false });
    prisma.module = {
      findUnique: vi.fn().mockImplementation(({ where }) => {
        if (where.slug === 'template-engine') return Promise.resolve(DB_TEMPLATE_ENGINE_INSTALLED);
        return Promise.resolve(depRecord(where.slug));
      }),
      findMany: vi.fn().mockResolvedValue([
        DB_THEME_ENGINE_UI_ENABLED, DB_PAGE_BUILDER_UI_ENABLED,
        DB_THEME_ENGINE_ENABLED, DB_PAGE_BUILDER_ENABLED,
        DB_BRAND_KIT_ENABLED, DB_COLLATERAL_ENABLED, DB_CREDITS_ENABLED,
      ]),
      update: vi.fn(),
    };

    prisma.$transaction = vi.fn().mockRejectedValue(new Error('DB connection lost'));

    const err = await enableModule('template-engine', 'actor', { resolveConflicts: true }).catch((e) => e);

    // The thrown error propagates — not a 409 status error
    expect(err.message).toMatch(/DB connection lost/);
    // Prisma update was never called directly (all within failed transaction)
    expect(prisma.module.update).not.toHaveBeenCalled();
  });

  /**
   * Test 6: listModules() reports conflicts in both directions
   * Setup: template-engine ENABLED; page-builder-ui INSTALLED; theme-engine-ui ENABLED
   * - template-engine.conflicts = [theme-engine-ui] (direction 1: own conflictsWith, theme-engine-ui is ENABLED)
   * - page-builder-ui.conflicts = [template-engine] (direction 2: template-engine lists page-builder-ui and is ENABLED)
   */
  it('listModules() reports conflicts in both directions', async () => {
    loadTemplateEngineManifests();

    const allDbModules = [
      DB_TEMPLATE_ENGINE_ENABLED,
      { slug: 'page-builder-ui', name: 'Page Builder UI', status: 'INSTALLED', is_core: false, id: 'id-pbui' },
      DB_THEME_ENGINE_UI_ENABLED,
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

    // Direction 1: template-engine's own conflictsWith → theme-engine-ui is ENABLED
    const teConflictSlugs = bySlug['template-engine'].conflicts.map((c) => c.slug);
    expect(teConflictSlugs).toContain('theme-engine-ui');
    // page-builder-ui is INSTALLED (not ENABLED) so does NOT appear in template-engine.conflicts
    expect(teConflictSlugs).not.toContain('page-builder-ui');

    // Direction 2: template-engine (ENABLED) lists page-builder-ui in its conflictsWith
    const pbUiConflictSlugs = bySlug['page-builder-ui'].conflicts.map((c) => c.slug);
    expect(pbUiConflictSlugs).toContain('template-engine');

    // Verify conflictsWith field present on manifests
    expect(bySlug['template-engine'].conflictsWith).toEqual(
      expect.arrayContaining(['theme-engine-ui', 'page-builder-ui'])
    );
    expect(bySlug['page-builder-ui'].conflictsWith).toEqual([]);
  });
});
