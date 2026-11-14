import { slugify } from './utils/slug.js';
import { PAGE_KEY_RESERVED } from './reserved-segments.js';

// The one place that says what address a page has. Everything that needs a page's URL asks here: the site
// generator, the public page lookup, the sitemap, the menus and website-copy generation.
//
//   route key   a stable, URL-safe name stored on the page (builder_pages.route_key), set when the page is made
//               and not changed when the title is edited. Not unique by itself: several drafts can share "home".
//   route       the real address of a page in a site: its key, made unique and kept off platform paths,
//               "" for the front page. assignRoutes() decides it for a whole set of pages at once.

/** `te-<run>-<key>`-style slugs written by the website stage carry their key after the run id. */
export const generatedKey = (slug) => /^.+?-c[a-z0-9]{24}-(.+)$/.exec(slug ?? '')?.[1];

/** The key a new page gets: the stage key in its slug, "home" for a slug ending in -home, else its title, else its slug. */
export const deriveRouteKey = ({ slug, title }) =>
  generatedKey(slug) || (/(^|-)home$/.test(slug ?? '') ? 'home' : '') || slugify(title) || slugify(slug) || 'page';

/** A page's key: the stored one, or what it would have been given (pages not yet backfilled). */
export const routeKeyOf = (page) => page.route_key || deriveRouteKey(page);

/** A front page candidate: its key is "home". */
export const isHomePage = (page) => routeKeyOf(page) === 'home';

/**
 * Which page is the site's front page. Several pages can be called Home (old drafts included): the published
 * one wins, and a draft only wins when no Home is published. Landing pages and a detail-page instance never are.
 */
export function pickHome(pages) {
  const homes = pages.filter((p) => !p.root && !p.landing && !p.template_id && isHomePage(p));
  return homes.find((p) => p.status === 'PUBLISHED') ?? homes[0] ?? null;
}

/**
 * Friendly, unique route per page: its key. The front page is "" (root). Pages flagged `root` (a landing page
 * exported on its own) are the front page; `landing` pages are addressed by their slug.
 */
export function assignRoutes(pages) {
  const used = new Set(['']);
  let homeTaken = false;
  const homeId = pickHome(pages)?.id;
  const claim = (base) => {
    const safe = PAGE_KEY_RESERVED.has(base) ? `${base}-page` : base;
    let route = safe;
    for (let n = 2; used.has(route); n += 1) route = `${safe}-${n}`;
    used.add(route);
    return route;
  };
  return pages.map((p) => {
    if (p.root) return { ...p, route: '' };
    if (p.landing) return { ...p, route: claim(p.slug) };
    if (p.id === homeId && !homeTaken) {
      homeTaken = true;
      return { ...p, route: '' };
    }
    return { ...p, route: claim(routeKeyOf(p)) };
  });
}

export const hrefOfRoute = (route) => (route ? `/${route}` : '/');

/**
 * Slug -> route for a set of routed pages (assignRoutes output). Seeded links name pages as te-<run>-<key>; when that
 * exact page is absent, a page with the same key still matches. Returns undefined when nothing matches.
 */
export function routeResolver(routed) {
  const bySlug = new Map(routed.map((p) => [p.slug, p.route]));
  // Only generated slugs carry a key; a plain slug must never match through a missing one.
  const byKey = new Map(routed.filter((p) => generatedKey(p.slug)).map((p) => [generatedKey(p.slug), p.route]).reverse());
  return (slug) => {
    if (bySlug.has(slug)) return bySlug.get(slug);
    const key = generatedKey(slug);
    return key ? byKey.get(key) : undefined;
  };
}

/**
 * Links saved in the admin (button hrefs, multi-line nav text) are `/p/<slug>`. Point every one that names a known
 * page at that page's real route, anywhere inside a string, array or object. Unknown slugs are left as written.
 */
export function rewritePageLinks(value, resolve) {
  const walk = (v) =>
    typeof v === 'string'
      ? v.replace(/\/p\/([a-z0-9-]+)/g, (m, slug) => {
          const route = resolve(slug);
          return route === undefined ? m : hrefOfRoute(route);
        })
      : Array.isArray(v)
        ? v.map(walk)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]))
          : v;
  return walk(value);
}
