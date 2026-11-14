import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestSchema } from './manifest-schema.js';
import { validateModuleGraph, describeIssue, describeManifest } from './module-graph.js';

const man = (slug, o = {}) => manifestSchema.parse({ slug, name: slug, version: '1.0.0', apiPrefix: `/api/${slug}`, ...o });
const graph = (...ms) => new Map(ms.map((m) => [m.slug, m]));

describe('validateModuleGraph', () => {
  it('accepts a sound graph', () => {
    expect(validateModuleGraph(graph(man('a', { core: true }), man('b', { dependsOn: ['a'] })))).toEqual([]);
  });

  it('reports unknown dependency, conflict and peer names', () => {
    const issues = validateModuleGraph(graph(man('a', { dependsOn: ['x'], conflictsWith: ['y'], navSuppressedByPeer: ['z'] })));
    expect(issues.map((i) => `${i.field}:${i.target}`).sort()).toEqual(['conflictsWith:y', 'dependsOn:x', 'navSuppressedByPeer:z']);
  });

  it('reports a self dependency', () => {
    expect(validateModuleGraph(graph(man('a', { dependsOn: ['a'] })))[0]).toMatchObject({ type: 'self-dependency', module: 'a' });
  });

  it('reports each cycle once, with its path', () => {
    const issues = validateModuleGraph(graph(man('a', { dependsOn: ['b'] }), man('b', { dependsOn: ['c'] }), man('c', { dependsOn: ['a'] })));
    const cycles = issues.filter((i) => i.type === 'cycle');
    expect(cycles).toHaveLength(1);
    expect(new Set(cycles[0].path)).toEqual(new Set(['a', 'b', 'c']));
    expect(describeIssue(cycles[0])).toMatch(/dependency cycle: .* -> .*/);
  });

  it('reports a core module that needs an optional one', () => {
    const issues = validateModuleGraph(graph(man('opt'), man('core1', { core: true, dependsOn: ['opt'] })));
    expect(issues).toEqual([{ type: 'core-depends-on-optional', module: 'core1', target: 'opt' }]);
  });
});

describe('describeManifest', () => {
  it('derives routes, group and requirements from the manifest alone', () => {
    const d = describeManifest(
      man('shop', {
        group: 'cms',
        dependsOn: ['core1'],
        env: ['SHOP_KEY'],
        permissions: ['shop', { name: 'orders', actions: ['view'] }],
        nav: [{ label: 'Shop', path: '/admin/shop' }],
        frontendRoutes: ['/shop', '/admin/shop'],
      })
    );
    expect(d).toMatchObject({
      group: 'cms',
      backendRoutes: ['/api/shop'],
      frontendRoutes: ['/admin/shop', '/shop'],
      permissions: ['shop', 'orders'],
      requirements: { dependsOn: ['core1'], env: ['SHOP_KEY'] },
    });
  });

  it('falls back to core / other when no group is set', () => {
    expect(describeManifest(man('x', { core: true })).group).toBe('core');
    expect(describeManifest(man('y')).group).toBe('other');
  });
});

// The real modules on disk: this is the CI guard for "one consistent module system".
describe('the modules in backend/src/modules', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '../../modules');
  const folders = readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  const manifests = new Map();
  for (const f of folders) {
    const p = join(dir, f, 'module.json');
    if (existsSync(p)) manifests.set(f, manifestSchema.parse(JSON.parse(readFileSync(p, 'utf8'))));
  }

  it('every module folder with routes has a manifest', () => {
    const missing = folders.filter((f) => existsSync(join(dir, f, 'routes.js')) && !manifests.has(f));
    expect(missing).toEqual([]);
  });

  it('every manifest slug equals its folder name and has a group', () => {
    for (const [folder, m] of manifests) {
      expect(m.slug).toBe(folder);
      expect(m.group, `${folder} has no group`).toBeTruthy();
    }
  });

  it('api prefixes are unique', () => {
    const seen = new Map();
    for (const m of manifests.values()) {
      expect(seen.get(m.apiPrefix), `${m.apiPrefix} used by ${seen.get(m.apiPrefix)} and ${m.slug}`).toBeUndefined();
      seen.set(m.apiPrefix, m.slug);
    }
  });

  it('the dependency graph has no unknown names, cycles or core-on-optional dependencies', () => {
    expect(validateModuleGraph(manifests).map(describeIssue)).toEqual([]);
  });
});
