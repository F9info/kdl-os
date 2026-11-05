import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRODUCTS, PRODUCT_KEYS, resolveProducts, inferProducts, buildGraph, siteOnlyModules, hiddenByProducts } from './products.js';

// Real manifests from disk, so renamed or removed slugs break this test.
const MODULES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const real = new Map();
for (const d of readdirSync(MODULES_DIR)) {
  const f = join(MODULES_DIR, d, 'module.json');
  if (existsSync(f)) {
    const m = JSON.parse(readFileSync(f, 'utf8'));
    real.set(m.slug, m);
  }
}

const subsets = [
  ['admin'],
  ['website'],
  ['landing'],
  ['admin', 'website'],
  ['admin', 'landing'],
  ['website', 'landing'],
  ['admin', 'website', 'landing'],
];

describe('PRODUCTS config', () => {
  it('only references modules that exist', () => {
    for (const key of PRODUCT_KEYS) for (const slug of PRODUCTS[key].required) expect(real.has(slug), `${key}: ${slug}`).toBe(true);
  });
});

describe('resolveProducts: all 7 combinations resolve', () => {
  it.each(subsets)('%s', (...selected) => {
    const r = resolveProducts({ selected, manifests: real });
    expect(r.valid).toBe(true);
    expect(r.unknownModules).toEqual([]);
    const union = new Set(selected.flatMap((p) => PRODUCTS[p].required));
    for (const slug of union) expect(r.modules).toContain(slug);
    // every dependency appears before its dependent
    r.modules.forEach((slug, i) => {
      for (const dep of real.get(slug).dependsOn ?? []) expect(r.modules.indexOf(dep), `${dep} before ${slug}`).toBeLessThan(i);
    });
    // required_by names only selected products
    for (const by of Object.values(r.requiredBy)) for (const p of by) expect(selected).toContain(p);
  });

  it('expands transitive dependencies (website pulls cms children)', () => {
    const r = resolveProducts({ selected: ['website'], manifests: real });
    expect(r.modules).toEqual(expect.arrayContaining(['faq', 'team', 'page-builder', 'theme-engine']));
  });

  it('shared modules list every product that needs them', () => {
    const r = resolveProducts({ selected: ['website', 'landing'], manifests: real });
    expect(r.requiredBy.media).toEqual(['landing', 'website']);
    expect(r.requiredBy.menus).toEqual(['website']);
  });

  it('empty selection resolves to nothing; unknown product is invalid', () => {
    expect(resolveProducts({ selected: [], manifests: real }).modules).toEqual([]);
    const r = resolveProducts({ selected: ['website', 'blog'], manifests: real });
    expect(r.valid).toBe(false);
    expect(r.unknownProducts).toEqual(['blog']);
  });

  it('splits toEnable from alreadyEnabled', () => {
    const r = resolveProducts({ selected: ['landing'], manifests: real, enabled: ['media', 'page-builder'] });
    expect(r.alreadyEnabled).toEqual(expect.arrayContaining(['media', 'page-builder']));
    expect(r.toEnable).not.toContain('media');
    expect(r.toEnable).toContain('page-builder-ui');
  });
});

describe('conflicts', () => {
  const manifests = new Map(real);
  manifests.set('menus', { ...real.get('menus'), conflictsWith: ['legacy-nav'] });
  manifests.set('legacy-nav', { slug: 'legacy-nav', name: 'Legacy', conflictsWith: [] });

  it('blocks when a resolved module conflicts with an enabled one', () => {
    const r = resolveProducts({ selected: ['website'], manifests, enabled: ['legacy-nav'] });
    expect(r.valid).toBe(false);
    expect(r.conflicts).toEqual([{ module: 'menus', conflictsWith: 'legacy-nav', enabled: true }]);
  });

  it('detects the reverse direction (enabled module lists the resolved one)', () => {
    const m = new Map(real);
    m.set('legacy-nav', { slug: 'legacy-nav', conflictsWith: ['menus'] });
    const r = resolveProducts({ selected: ['website'], manifests: m, enabled: ['legacy-nav'] });
    expect(r.conflicts).toHaveLength(1);
  });

  it('is valid when nothing conflicts', () => {
    expect(resolveProducts({ selected: ['website'], manifests, enabled: [] }).valid).toBe(true);
  });
});

describe('removal keeps data and modules', () => {
  it('reports modules no longer required but never disables them', () => {
    const enabled = [...resolveProducts({ selected: ['website', 'landing'], manifests: real }).modules];
    const r = resolveProducts({ selected: ['landing'], previous: ['website', 'landing'], manifests: real, enabled });
    expect(r.noLongerRequired).toEqual(expect.arrayContaining(['menus', 'cms']));
    expect(r.noLongerRequired).not.toContain('media'); // landing still needs it
    expect(r.toEnable).toEqual([]);
  });
});

describe('buildGraph', () => {
  it('lists every manifest with dependents and flags', () => {
    const g = buildGraph({ manifests: real, enabled: ['media'], selected: ['website'] });
    expect(g.modules).toHaveLength(real.size);
    const pb = g.modules.find((m) => m.slug === 'page-builder');
    expect(pb.required_by).toContain('page-builder-ui');
    expect(pb.required_by_products).toEqual(['website']);
    expect(g.modules.find((m) => m.slug === 'media').enabled).toBe(true);
    expect(g.products.map((p) => p.key)).toEqual(PRODUCT_KEYS);
  });
});

describe('siteOnlyModules / hiddenByProducts (real manifests)', () => {
  it('site-only = CMS, menus, page builder UI, theme UI and their parts; never Admin or shared modules', () => {
    const site = siteOnlyModules(real);
    for (const m of ['cms', 'menus', 'page-builder-ui', 'theme-engine-ui', 'faq']) expect(site.has(m), m).toBe(true);
    for (const m of ['media', 'settings', 'identity', 'users']) expect(site.has(m), m).toBe(false);
  });

  it('hides only when something is chosen and no site product is among it', () => {
    expect(hiddenByProducts([], real).size).toBe(0);
    expect(hiddenByProducts(['admin'], real).size).toBeGreaterThan(0);
    expect(hiddenByProducts(['admin', 'landing'], real).size).toBe(0);
    expect(hiddenByProducts(['website'], real).size).toBe(0);
  });
});

describe('inferProducts (Products page shows the effective state)', () => {
  const allOf = (...keys) => [...resolveProducts({ selected: keys, manifests: real }).modules];

  it('a product whose modules are all enabled is on even though nobody chose it', () => {
    expect(inferProducts({ manifests: real, enabled: allOf('website', 'landing'), stored: [] })).toEqual(
      expect.arrayContaining(['website', 'landing'])
    );
  });

  it('a product missing any required module is not inferred', () => {
    const enabled = allOf('website').filter((m) => m !== 'menus');
    expect(inferProducts({ manifests: real, enabled, stored: [] })).not.toContain('website');
    expect(inferProducts({ manifests: real, enabled: [], stored: [] })).toEqual([]);
  });

  it('products already chosen are not repeated', () => {
    expect(inferProducts({ manifests: real, enabled: allOf('website'), stored: ['website'] })).not.toContain('website');
  });

  it('buildGraph reports the inferred products alongside the selection', () => {
    const g = buildGraph({ manifests: real, enabled: [], selected: ['website'], inferred: ['landing'] });
    expect(g.selected).toEqual(['website']);
    expect(g.inferred).toEqual(['landing']);
  });
});
