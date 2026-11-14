// Pure helpers over module manifests: whole-graph validation and a normalized description. No I/O, so the
// loader (at boot), the CI test and the admin API all use the same rules.

/**
 * Problems in a set of manifests (Map slug -> manifest). Empty array = the graph is sound.
 *  - unknown-dependency   dependsOn / conflictsWith / navSuppressedByPeer names a module that does not exist
 *  - self-dependency      a module that depends on itself
 *  - cycle                modules that (transitively) depend on each other; `path` lists them in order
 *  - core-depends-on-optional  a core module (always on) that needs a module that can be switched off
 */
export function validateModuleGraph(manifests) {
  const issues = [];
  for (const [slug, m] of manifests) {
    for (const [field, list] of [
      ['dependsOn', m.dependsOn],
      ['conflictsWith', m.conflictsWith],
      ['navSuppressedByPeer', m.navSuppressedByPeer],
    ]) {
      for (const dep of list ?? []) {
        if (!manifests.has(dep)) issues.push({ type: 'unknown-dependency', module: slug, field, target: dep });
      }
    }
    for (const dep of m.dependsOn ?? []) {
      if (dep === slug) issues.push({ type: 'self-dependency', module: slug });
      else if (m.core && manifests.has(dep) && !manifests.get(dep).core) {
        issues.push({ type: 'core-depends-on-optional', module: slug, target: dep });
      }
    }
  }

  // Cycle detection: colour DFS (0 = new, 1 = on the current path, 2 = done). Each cycle is reported once.
  const state = new Map();
  const stack = [];
  const seen = new Set();
  const visit = (slug) => {
    state.set(slug, 1);
    stack.push(slug);
    for (const dep of manifests.get(slug)?.dependsOn ?? []) {
      if (dep === slug || !manifests.has(dep)) continue;
      if (state.get(dep) === 1) {
        const path = [...stack.slice(stack.indexOf(dep)), dep];
        const key = [...new Set(path)].sort().join('>');
        if (!seen.has(key)) {
          seen.add(key);
          issues.push({ type: 'cycle', module: dep, path });
        }
      } else if (!state.get(dep)) visit(dep);
    }
    stack.pop();
    state.set(slug, 2);
  };
  for (const slug of manifests.keys()) if (!state.get(slug)) visit(slug);
  return issues;
}

/** One-line, human readable form of an issue (logs and test failures). */
export function describeIssue(i) {
  switch (i.type) {
    case 'unknown-dependency':
      return `"${i.module}" ${i.field} names unknown module "${i.target}"`;
    case 'self-dependency':
      return `"${i.module}" depends on itself`;
    case 'cycle':
      return `dependency cycle: ${i.path.join(' -> ')}`;
    case 'core-depends-on-optional':
      return `core module "${i.module}" depends on optional module "${i.target}"`;
    default:
      return JSON.stringify(i);
  }
}

/**
 * Everything the install/activation screens and dashboards need about one module, in one shape, derived from
 * the manifest only (nothing is stored twice): where its backend lives, which frontend routes it owns, and
 * what it needs before it can run.
 */
export function describeManifest(m) {
  const navPaths = (m.nav ?? []).map((n) => n.path);
  return {
    slug: m.slug,
    name: m.name,
    version: m.version,
    description: m.description ?? '',
    group: m.group ?? (m.core ? 'core' : 'other'),
    core: !!m.core,
    umbrella: !!m.umbrella,
    backendRoutes: [m.apiPrefix],
    frontendRoutes: [...new Set([...navPaths, ...(m.frontendRoutes ?? [])])],
    permissions: (m.permissions ?? []).map((p) => (typeof p === 'string' ? p : p.name)),
    requirements: {
      dependsOn: m.dependsOn ?? [],
      conflictsWith: m.conflictsWith ?? [],
      env: m.env ?? [],
      queues: m.queues ?? [],
    },
  };
}
