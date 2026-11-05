// Product -> module resolver (docs/planning/04-product-module-matrix.md). Pure functions only:
// callers supply the manifests and the currently enabled slugs, so this is easy to test.

// Real module slugs. `required` lists direct requirements; transitive dependsOn is expanded
// by the resolver. forms/seo modules from the doc do not exist yet; add them here when they do.
export const PRODUCTS = {
  admin: {
    name: 'Admin',
    description: 'Internal business app: users, roles, settings, identity.',
    required: ['users', 'user-management', 'settings', 'identity', 'media'],
  },
  website: {
    name: 'Website',
    description: 'Multi-page corporate site with CMS, menus and page builder.',
    required: ['cms', 'menus', 'page-builder-ui', 'theme-engine-ui', 'media'],
  },
  landing: {
    name: 'Landing Pages',
    description: 'Campaign and product pages built with the page builder.',
    required: ['landing', 'page-builder-ui', 'theme-engine-ui', 'media'],
  },
};

export const PRODUCT_KEYS = Object.keys(PRODUCTS);
export const PRODUCTS_SETTING_KEY = 'products.enabled';

const sorted = (set) => [...set].sort();

/**
 * @param {object} args
 * @param {string[]} args.selected   products wanted now
 * @param {string[]} [args.previous] products selected before (to report modules no longer required)
 * @param {Map<string, {dependsOn?: string[], conflictsWith?: string[], core?: boolean}>} args.manifests
 * @param {Set<string>|string[]} [args.enabled] currently enabled module slugs
 */
export function resolveProducts({ selected, previous = [], manifests, enabled = [] }) {
  const enabledSet = new Set(enabled);
  const unknownProducts = selected.filter((p) => !PRODUCTS[p]);
  const picked = [...new Set(selected.filter((p) => PRODUCTS[p]))];

  // slug -> products that need it (directly or through dependsOn)
  const requiredBy = new Map();
  const unknownModules = new Set();
  const order = []; // dependencies first

  const visit = (slug, product, stack) => {
    if (!manifests.has(slug)) {
      unknownModules.add(slug);
      return;
    }
    if (!requiredBy.has(slug)) requiredBy.set(slug, new Set());
    requiredBy.get(slug).add(product);
    if (stack.includes(slug) || order.includes(slug)) return; // cycle or already placed
    for (const dep of manifests.get(slug).dependsOn ?? []) visit(dep, product, [...stack, slug]);
    if (!order.includes(slug)) order.push(slug);
  };
  for (const p of picked) for (const slug of PRODUCTS[p].required) visit(slug, p, []);

  const resolved = new Set(order);

  // Conflicts: a resolved module vs anything enabled or also resolved (either manifest direction).
  const conflicts = [];
  const seen = new Set();
  const others = new Set([...enabledSet, ...resolved]);
  for (const slug of resolved) {
    for (const other of others) {
      if (other === slug) continue;
      const clash =
        (manifests.get(slug).conflictsWith ?? []).includes(other) ||
        (manifests.get(other)?.conflictsWith ?? []).includes(slug);
      const key = [slug, other].sort().join('|');
      if (clash && !seen.has(key)) {
        seen.add(key);
        conflicts.push({ module: slug, conflictsWith: other, enabled: enabledSet.has(other) });
      }
    }
  }

  // Modules the previous selection needed that the new one does not: stay enabled (optional), data kept.
  const stillNeeded = new Set(resolved);
  const prevRequired = new Set();
  for (const p of previous.filter((x) => PRODUCTS[x])) {
    const sub = resolveProducts({ selected: [p], manifests });
    sub.modules.forEach((m) => prevRequired.add(m));
  }
  const noLongerRequired = sorted([...prevRequired].filter((m) => !stillNeeded.has(m) && enabledSet.has(m)));

  return {
    valid: unknownProducts.length === 0 && unknownModules.size === 0 && conflicts.length === 0,
    selected: picked,
    unknownProducts,
    unknownModules: sorted(unknownModules),
    modules: order, // enable in this order
    toEnable: order.filter((m) => !enabledSet.has(m)),
    alreadyEnabled: order.filter((m) => enabledSet.has(m)),
    requiredBy: Object.fromEntries(order.map((m) => [m, sorted(requiredBy.get(m))])),
    conflicts,
    noLongerRequired,
  };
}

/**
 * Products that are already ON because every module they need is enabled, even though nobody chose
 * them in Settings > Products (modules installed one by one on the Modules page). Display only: the
 * saved selection stays the only thing that hides navigation entries (see hiddenByProducts).
 */
export function inferProducts({ manifests, enabled = [], stored = [] }) {
  const enabledSet = new Set(enabled);
  return PRODUCT_KEYS.filter((key) => {
    if (stored.includes(key)) return false;
    const r = resolveProducts({ selected: [key], manifests, enabled: enabledSet });
    return r.valid && r.toEnable.length === 0;
  });
}

/** Module graph for the admin UI: every manifest with its dependents (reverse dependsOn). */
export function buildGraph({ manifests, enabled = [], selected = [], inferred = [] }) {
  const enabledSet = new Set(enabled);
  const dependents = new Map();
  for (const [slug, m] of manifests) {
    for (const dep of m.dependsOn ?? []) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep).push(slug);
    }
  }
  const resolution = resolveProducts({ selected, manifests, enabled: enabledSet });
  const modules = [...manifests].map(([slug, m]) => ({
    slug,
    name: m.name,
    core: m.core ?? false,
    enabled: enabledSet.has(slug),
    dependsOn: m.dependsOn ?? [],
    conflictsWith: m.conflictsWith ?? [],
    required_by: sorted(dependents.get(slug) ?? []), // modules (enabled or not) that depend on it
    required_by_products: resolution.requiredBy[slug] ?? [],
  }));
  return {
    products: PRODUCT_KEYS.map((key) => ({ key, ...PRODUCTS[key] })),
    selected: resolution.selected,
    inferred,
    modules,
    resolution,
  };
}

export const SITE_PRODUCTS = ['website', 'landing'];

/**
 * Modules only the site products (Website, Landing) need: required by them and not by Admin.
 * T2.4 hides their sidebar entries when products are chosen and none is a site product.
 */
export function siteOnlyModules(manifests) {
  const admin = new Set(resolveProducts({ selected: ['admin'], manifests }).modules);
  return new Set(resolveProducts({ selected: SITE_PRODUCTS, manifests }).modules.filter((m) => !admin.has(m)));
}

/**
 * Slugs whose nav is hidden for the saved selection. An empty selection means products were never
 * chosen (existing installs), so nothing is hidden. Hiding is nav-only: modules stay enabled.
 */
export function hiddenByProducts(selected, manifests) {
  if (selected.length === 0 || selected.some((p) => SITE_PRODUCTS.includes(p))) return new Set();
  return siteOnlyModules(manifests);
}
