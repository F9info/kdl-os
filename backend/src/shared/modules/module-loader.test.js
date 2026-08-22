import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSchema } from './manifest-schema.js';
import { checkDependencyIntegrity } from './module-loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = join(__dirname, '../../modules');

// Build a real manifest map from on-disk module.json files — no mocks.
// Follows the same pattern as manifest-schema.test.js.
function buildRealManifests() {
  const manifests = new Map();
  const entries = readdirSync(MODULES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(MODULES_DIR, entry.name, 'module.json');
    let raw;
    try {
      raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      continue;
    }
    const parsed = manifestSchema.safeParse(raw);
    if (parsed.success && parsed.data.slug === entry.name) {
      manifests.set(parsed.data.slug, parsed.data);
    }
  }
  return manifests;
}

const realManifests = buildRealManifests();

describe('checkDependencyIntegrity — real manifests, no module-loader mock', () => {
  it('reports no violations when all template-engine deps are enabled (consistent state)', () => {
    // Full set that enables template-engine cleanly
    const enabledSlugs = [
      'template-engine',
      'projects',
      'theme-engine',
      'theme-engine-ui',
      'page-builder',
      'page-builder-ui',
      'brand-kit',
      'collateral',
      'credits',
    ];
    const violations = checkDependencyIntegrity(enabledSlugs, realManifests);
    expect(violations).toHaveLength(0);
  });

  it('reports violations for the KDL-593 drifted state: template-engine ENABLED, theme-engine-ui and page-builder-ui DISABLED', () => {
    // Mirrors the actual kdl_db state found during KDL-573 verification.
    // theme-engine-ui and page-builder-ui are absent from the enabled set.
    const enabledSlugs = [
      'template-engine',
      'projects',
      'theme-engine',
      'page-builder',
      'brand-kit',
      'collateral',
      'credits',
    ];
    const violations = checkDependencyIntegrity(enabledSlugs, realManifests);
    const disabledDeps = violations.map((v) => v.disabledDep);
    expect(disabledDeps).toContain('theme-engine-ui');
    expect(disabledDeps).toContain('page-builder-ui');
    expect(violations.every((v) => v.module === 'template-engine')).toBe(true);
  });

  it('reports no violations when no modules are enabled', () => {
    const violations = checkDependencyIntegrity([], realManifests);
    expect(violations).toHaveLength(0);
  });

  it('reports a violation when a dep slug is present in the map but not in the enabled set', () => {
    const fakeManifests = new Map([
      ['orphan', { slug: 'orphan', dependsOn: ['missing-dep'] }],
    ]);
    const violations = checkDependencyIntegrity(['orphan'], fakeManifests);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toEqual({ module: 'orphan', disabledDep: 'missing-dep' });
  });

  it('skips modules whose manifest is absent from the map without throwing', () => {
    // A slug in enabledSlugs that has no manifest entry — should not error.
    const violations = checkDependencyIntegrity(['ghost-module'], realManifests);
    expect(violations).toHaveLength(0);
  });
});
