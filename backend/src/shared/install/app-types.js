// The six things the first-run wizard offers, and the optional modules each one needs.
// Core modules are always on and are not listed. Dependencies are NOT listed either: the module
// lifecycle (installModule/enableModule) pulls them in, and `frontend: true` is the umbrella `cms`
// module, which seeds the demo website and the four landing pages itself.
// The choice only sets the starting point: it can be changed later (Settings > Application).
export const APP_TYPES = {
  landing: {
    name: 'Landing Page',
    description: 'One focused page to promote a product, service or campaign.',
    icon: 'Rocket',
    modules: ['cms'],
  },
  static: {
    name: 'Static Website',
    description: 'A multi-page website you design once and host anywhere.',
    icon: 'Globe',
    modules: ['cms'],
  },
  'web-app': {
    name: 'Web Application',
    description: 'A business application with forms and data capture.',
    icon: 'AppWindow',
    modules: ['forms'],
  },
  'admin-frontend': {
    name: 'Admin + Frontend Web Application',
    description: 'A public website together with the admin that runs it.',
    icon: 'LayoutDashboard',
    modules: ['cms', 'forms'],
  },
  multi: {
    name: 'Multiple Websites / Landing Pages',
    description: 'Several sites or campaign pages managed from one admin.',
    icon: 'Layers',
    modules: ['cms', 'page-builder-ui', 'theme-engine-ui'],
  },
  'admin-only': {
    name: 'Admin Only',
    description: 'Just the admin: users, roles, settings and media.',
    icon: 'ShieldCheck',
    modules: [],
  },
};

export const APP_TYPE_KEYS = Object.keys(APP_TYPES);
export const FRONTEND_MODULE = 'cms';
export const hasFrontend = (type) => !!APP_TYPES[type]?.modules.includes(FRONTEND_MODULE);

/** Optional modules (with their optional dependencies) a type needs, in install order. */
export function modulesFor(type, manifests) {
  const out = [];
  const seen = new Set();
  const visit = (slug) => {
    if (seen.has(slug)) return;
    seen.add(slug);
    const m = manifests.get(slug);
    if (!m) throw Object.assign(new Error(`Module "${slug}" not found`), { status: 500 });
    for (const dep of m.dependsOn ?? []) visit(dep);
    if (!m.core) out.push(slug);
  };
  for (const slug of APP_TYPES[type]?.modules ?? []) visit(slug);
  return out;
}
