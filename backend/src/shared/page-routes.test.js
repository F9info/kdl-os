import { describe, it, expect, vi } from 'vitest';
import {
  generatedKey,
  deriveRouteKey,
  routeKeyOf,
  isHomePage,
  pickHome,
  assignRoutes,
  hrefOfRoute,
  routeResolver,
  rewritePageLinks,
} from './page-routes.js';
import { backfillRouteKeys } from './page-routes-backfill.js';

const CUID = 'cmt15bmts000401s6fn5ydhzp';
const page = (id, title, extra = {}) => ({ id, slug: extra.slug ?? `p-${id}`, title, status: 'PUBLISHED', ...extra });

describe('route keys', () => {
  it('a generated slug carries its key; a -home slug is home; otherwise the title; then the slug', () => {
    expect(generatedKey(`te-${CUID}-about-us`)).toBe('about-us');
    expect(deriveRouteKey({ slug: `te-${CUID}-about-us`, title: 'Whatever' })).toBe('about-us');
    expect(deriveRouteKey({ slug: 'demo-home', title: 'Welcome' })).toBe('home');
    expect(deriveRouteKey({ slug: 'x', title: 'Our Work!' })).toBe('our-work');
    expect(deriveRouteKey({ slug: 'my-page', title: '!!!' })).toBe('my-page');
    expect(deriveRouteKey({ slug: '', title: '' })).toBe('page');
  });

  it('a stored key wins over anything derived, and renaming the title never changes it', () => {
    expect(routeKeyOf({ route_key: 'pricing', slug: 'a', title: 'Plans' })).toBe('pricing');
    expect(routeKeyOf({ route_key: null, slug: 'a', title: 'Plans' })).toBe('plans');
  });
});

describe('the front page', () => {
  it('is the published page with the key home; a draft only when none is published', () => {
    const draft = page('d', 'Home', { status: 'DRAFT', route_key: 'home' });
    const live = page('l', 'Home', { route_key: 'home' });
    expect(pickHome([draft, live]).id).toBe('l');
    expect(pickHome([draft, page('a', 'About')]).id).toBe('d');
    expect(pickHome([page('a', 'About')])).toBeNull();
  });

  it('never a landing page, a root-exported page, or a detail-page instance', () => {
    expect(isHomePage(page('x', 'Home'))).toBe(true);
    expect(pickHome([page('x', 'Home', { landing: true })])).toBeNull();
    expect(pickHome([page('x', 'Home', { template_id: 't1' })])).toBeNull();
  });
});

describe('assignRoutes', () => {
  it('home is "", others are their key, duplicates get -2, -3', () => {
    const routes = assignRoutes([page('1', 'Home'), page('2', 'About'), page('3', 'About', { slug: 'about-2' })]).map((p) => p.route);
    expect(routes).toEqual(['', 'about', 'about-2']);
  });

  it('a key that is a platform path gets -page, so it cannot shadow the admin or the API', () => {
    expect(assignRoutes([page('1', 'Admin'), page('2', 'Api')]).map((p) => p.route)).toEqual(['admin-page', 'api-page']);
  });

  it('only one page takes "/": a second Home gets its key', () => {
    const [a, b] = assignRoutes([page('1', 'Home', { route_key: 'home' }), page('2', 'Home', { route_key: 'home', slug: 'home-2' })]);
    expect([a.route, b.route]).toEqual(['', 'home']);
  });

  it('landing pages are addressed by slug, a root page is "/"', () => {
    const out = assignRoutes([page('1', 'Home', { landing: true, slug: 'spring' }), page('2', 'x', { root: true })]);
    expect(out.map((p) => p.route)).toEqual(['spring', '']);
  });

  it('hrefOfRoute', () => {
    expect(hrefOfRoute('')).toBe('/');
    expect(hrefOfRoute('about')).toBe('/about');
  });
});

describe('backfillRouteKeys', () => {
  const mk = (pages, stages = []) => {
    const store = pages.map((p) => ({ ...p }));
    return {
      store,
      builderPage: {
        findMany: vi.fn(async ({ take }) => store.filter((p) => !p.route_key).slice(0, take)),
        update: vi.fn(async ({ where, data }) => Object.assign(store.find((p) => p.id === where.id), data)),
      },
      templateEngineStage: { findMany: vi.fn(async () => stages) },
    };
  };

  it('uses the key the website stage recorded, else derives one, and leaves keyed pages alone', async () => {
    const db = mk(
      [
        { id: 'a', slug: 'weird-slug', title: 'Anything' },
        { id: 'b', slug: 'b', title: 'Contact Us' },
        { id: 'c', slug: 'c', title: 'Keep', route_key: 'kept' },
      ],
      [{ outputRef: { pageKeyToId: { 'our-story': 'a' } } }]
    );
    expect(await backfillRouteKeys(db)).toBe(2);
    expect(db.store.map((p) => p.route_key)).toEqual(['our-story', 'contact-us', 'kept']);
  });

  it('does not change when the page was last modified', async () => {
    const at = new Date('2026-01-02T03:04:05Z');
    const db = mk([{ id: 'a', slug: 'a', title: 'A', updated_at: at }]);
    await backfillRouteKeys(db);
    expect(db.builderPage.update.mock.calls[0][0].data).toEqual({ route_key: 'a', updated_at: at });
  });

  it('is a no-op the second time', async () => {
    const db = mk([{ id: 'a', slug: 'a', title: 'A' }]);
    await backfillRouteKeys(db);
    db.builderPage.update.mockClear();
    expect(await backfillRouteKeys(db)).toBe(0);
    expect(db.builderPage.update).not.toHaveBeenCalled();
  });
});

describe('rewritePageLinks', () => {
  const routed = assignRoutes([
    page('1', 'Home', { slug: 'demo-home', route_key: 'home' }),
    page('2', 'Contact', { slug: 'demo-contact', route_key: 'contact' }),
    page('3', 'About', { slug: `te-${CUID}-about`, route_key: 'about' }),
  ]);
  const resolve = routeResolver(routed);

  it('finds a page by its slug, and by its key when only the generated prefix differs', () => {
    expect(resolve('demo-contact')).toBe('contact');
    expect(resolve('demo-home')).toBe('');
    expect(resolve(`te-cother0000000000000000000-about`)).toBe('about');
    expect(resolve('nope')).toBeUndefined();
  });

  it('rewrites links anywhere in strings, arrays and objects; the front page becomes "/"; unknown slugs stay', () => {
    const out = rewritePageLinks({ a: '/p/demo-contact', b: ['x /p/demo-home y', { c: '/p/missing-page' }], n: 3, z: null }, resolve);
    expect(out).toEqual({ a: '/contact', b: ['x / y', { c: '/p/missing-page' }], n: 3, z: null });
  });

  it('does not change its input', () => {
    const input = { href: '/p/demo-contact' };
    rewritePageLinks(input, resolve);
    expect(input.href).toBe('/p/demo-contact');
  });
});
