// The one place that says which first URL segments belong to the platform, so a page key or a detail-type
// prefix can never shadow them. Keep in step with infra/nginx/nginx.conf (what goes to the admin app) and the
// top-level folders of frontend/src/app. Both the site generator and the detail-page types read from here.

// Owned by nginx, the admin app or the site shell: no page may take these as its address.
export const PAGE_KEY_RESERVED = new Set([
  'api',
  'ai',
  '_next',
  'static',
  'site-assets',
  'seed',
  'vendor',
  'p',
  'login',
  'register',
  'forgot-password',
  'reset-password',
  'change-password',
  'admin',
  'share',
]);

// A detail type's /<prefix>/<slug> additionally must not shadow the built-in detail routes or a route tree
// served by the admin app (member area, previews, installer, revalidate hook).
export const DETAIL_PREFIX_RESERVED = new Set([
  ...PAGE_KEY_RESERVED,
  'work',
  'sectors',
  'catalog',
  'membership',
  'preview',
  'install',
  'revalidate',
]);
