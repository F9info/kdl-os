import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../brand-kit/contact-fields.js', () => ({ getCompanyInfo: vi.fn() }));

const { assignRoutes, buildSiteModel } = await import('./generator.js');

const page = (id, title, slug = `te-run-${id}`) => ({ id, title, slug, status: 'DRAFT', data: { content: [] } });

describe('site generator', () => {
  it('gives pages friendly, unique routes and Home the root', () => {
    const routes = assignRoutes([
      page('1', 'Home'),
      page('2', 'About Us'),
      page('3', 'About us'),
      page('4', 'API'),
    ]).map((p) => p.route);
    expect(routes).toEqual(['', 'about-us', 'about-us-2', 'api-page']);
  });

  it('uses the menu-name slug (page key) as the route, not the page title', () => {
    const slug = 'te-cmt18teqh000101rxwfzfndow-contact';
    const [p] = assignRoutes([page('1', "Let's talk about your building", slug)]);
    expect(p.route).toBe('contact');
  });

  it('rewrites /p/<slug> hrefs inside page data to friendly routes', () => {
    const slug = 'te-cmt18teqh000101rxwfzfndow-about-us';
    const pages = [{ ...page('1', 'About Us', slug), data: { content: [{ props: { href: `/p/${slug}?x=1`, nav: `About|/p/${slug}\nHome|/p/nope` } }] } }];
    const model = buildSiteModel({ project: { id: 'p', slug: 's', name: 'S' }, kit: null, pages, menus: [] });
    expect(model.pages[0].json.data.content[0].props.href).toBe('/about-us?x=1');
    expect(model.pages[0].json.data.content[0].props.nav).toBe('About|/about-us\nHome|/p/nope');
  });

  it('drops brand values that could break out of generated CSS/HTML', () => {
    const model = buildSiteModel({
      project: { id: 'p', slug: 's', name: 'S' },
      kit: {
        palette: { colors: { primary: { hex: '</style><script>alert(1)</script>' } } },
        typography: { heading: { family: "x';}</style>" }, body: { family: 'Open Sans' } },
      },
      pages: [],
      menus: [],
    });
    expect(model.site.colors.primary).toBe('#1d4ed8');
    expect(model.site.fonts).toEqual({ heading: 'Inter', body: 'Open Sans' });
  });

  it('maps menu links to friendly routes and honours no_page / inactive', () => {
    const item = (o) => ({ id: o.id, label: o.label, parent_id: null, order: 0, is_active: true, no_page: false, open_in_new_tab: false, url: null, page_id: null, ...o });
    const model = buildSiteModel({
      project: { id: 'p', slug: 'subhadra', name: 'Subhadra' },
      kit: { palette: { colors: { primary: { hex: '#f60' } } }, typography: { heading: { family: 'Poppins' } } },
      company: { company_name: 'Subhadra Group' },
      pages: [page('1', 'Home'), page('2', 'About Us', 'te-run-about')],
      menus: [
        {
          key: 'header',
          items: [
            item({ id: 'a', label: 'Home', page_id: '1' }),
            item({ id: 'b', label: 'About Us', no_page: true }),
            item({ id: 'c', label: 'About', parent_id: 'b', url: '/p/te-run-about' }),
            item({ id: 'd', label: 'Hidden', is_active: false }),
          ],
        },
      ],
    });
    const [home, about] = model.menus.header;
    expect(home.href).toBe('/');
    expect(about.href).toBeNull();
    expect(about.children[0].href).toBe('/about-us');
    expect(model.menus.header).toHaveLength(2);
    expect(model.site).toMatchObject({ name: 'Subhadra Group', colors: { primary: '#f60' }, fonts: { heading: 'Poppins', body: 'Inter' } });
    expect(model.pages.map((p) => p.file)).toEqual(['index', 'about-us']);
  });
});
