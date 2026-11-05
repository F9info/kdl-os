import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  prisma: {
    builderPage: { findMany: vi.fn() },
    templateEngineStage: { findMany: vi.fn() },
    form: { findMany: vi.fn() },
  },
}));
vi.mock('../../config/database.js', () => ({ prisma: h.prisma }));

const { validateContent, validatePage, linkTargets, summarize, schemaIssues } = await import('./validate.js');

const block = (type, props = {}) => ({ type, props: { id: `${type}-1`, ...props } });
const ctx = (over = {}) => ({
  pageSlugs: new Set(['about', 'contact']),
  siteKeys: new Set(['home', 'services']),
  formSlugs: new Set(['enquiry']),
  schemas: null, // schema checks are tested in their own block below
  ...over,
});
const page = (content, over = {}) => ({
  title: 'Spring',
  slug: 'spring',
  seo: { title: 'Spring', description: 'A good description.' },
  data: { content },
  ...over,
});
const codes = (p, c = ctx()) => validateContent(p, c).map((i) => i.code);
const hero = (props) => block('Hero', props);

describe('structure', () => {
  it('a clean page has no issues', () => {
    expect(codes(page([hero({ title: 'Hi' })]))).toEqual([]);
  });
  it('empty page and missing title are errors', () => {
    expect(codes(page([]))).toContain('PAGE_EMPTY');
    expect(codes(page([hero({})], { title: '  ' }))).toContain('TITLE_MISSING');
  });
  it('layout blocks (header/footer) do not count as content', () => {
    expect(codes(page([block('NavBar'), block('Footer')]))).toContain('PAGE_EMPTY');
  });
});

describe('images', () => {
  it('no source = error, no alt = warning, both fine = nothing', () => {
    expect(codes(page([block('Image', { src: '', alt: 'x' })]))).toContain('IMAGE_NO_SOURCE');
    const issues = validateContent(page([block('Image', { src: '/a.png', alt: '' })]), ctx());
    expect(issues).toEqual([
      expect.objectContaining({ code: 'IMAGE_NO_ALT', severity: 'warning', block_type: 'Image' }),
    ]);
    expect(codes(page([block('Image', { src: '/a.png', alt: 'A cat' })]))).toEqual([]);
  });
});

describe('links', () => {
  const withLink = (href) => page([hero({ ctaHref: href })]);
  it('external, mailto, tel and home are fine', () => {
    for (const href of ['https://x.com', 'mailto:a@b.co', 'tel:+911', '//cdn.x/y', '/', '/?a=1'])
      expect(codes(withLink(href)), href).toEqual([]);
  });
  it('/p/<slug> must be a published page; the page itself counts', () => {
    expect(codes(withLink('/p/about'))).toEqual([]);
  });
  it('a missing /p/<slug> or a missing clean key is an error', () => {
    expect(codes(withLink('/p/nope'))).toEqual(['LINK_BROKEN']);
    expect(codes(withLink('/nothing'))).toEqual(['LINK_BROKEN']);
    expect(codes(withLink('/services'))).toEqual([]); // a recorded site key
    expect(codes(withLink('/about'))).toEqual([]); // a published slug
  });
  it('app routes and deeper module URLs are not judged', () => {
    for (const href of ['/sectors', '/sectors/steel', '/work/x', '/login', '/blog/2026/post'])
      expect(codes(withLink(href)), href).toEqual([]);
  });
  it('anchors: fine when a block on the page has that anchor, a warning when nothing does', () => {
    expect(
      codes(
        page([
          hero({ ctaHref: '#contact' }),
          block('ContactForm', { formSlug: 'enquiry', anchor: 'contact' }),
        ])
      )
    ).toEqual([]);
    const issues = validateContent(withLink('#buy'), ctx());
    expect(issues[0]).toMatchObject({ code: 'ANCHOR_MISSING', severity: 'warning' });
  });
  it('checks "Label|target" lines in link lists, ignoring the layout header/footer', () => {
    const nav = page([block('Text', { links: 'Home|/\nGone|/p/zzz\nAbout|/p/about' })]);
    expect(codes(nav)).toEqual(['LINK_BROKEN']);
    expect(codes(page([block('Footer', { links: 'Gone|/p/zzz' }), hero({})]))).toEqual([]);
  });
  it('finds links inside nested props and arrays', () => {
    expect(linkTargets({ a: { b: [{ href: '/p/x' }, { ctaHref: '#y' }] }, links: 'A|/p/z' }).sort()).toEqual([
      '#y',
      '/p/x',
      '/p/z',
    ]);
  });
});

describe('forms', () => {
  it('a form block needs an active form', () => {
    expect(codes(page([block('ContactForm', { formSlug: '' })]))).toContain('FORM_NOT_SET');
    expect(codes(page([block('ContactForm', { formSlug: 'ghost' })]))).toContain('FORM_MISSING');
    expect(codes(page([block('ContactForm', { formSlug: 'enquiry', anchor: 'c' })]))).toEqual([]);
  });
});

describe('SEO', () => {
  it('missing description and title are warnings, long ones too', () => {
    const issues = validateContent(page([hero({})], { seo: null }), ctx());
    expect(issues.map((i) => i.code).sort()).toEqual(['SEO_DESCRIPTION_MISSING', 'SEO_TITLE_MISSING']);
    expect(issues.every((i) => i.severity === 'warning')).toBe(true);
    expect(codes(page([hero({})], { seo: { title: 'x'.repeat(61), description: 'd' } }))).toContain(
      'SEO_TITLE_LONG'
    );
    expect(codes(page([hero({})], { seo: { title: 't', description: 'd'.repeat(161) } }))).toContain(
      'SEO_DESCRIPTION_LONG'
    );
  });
  it('the SEO title falls back to the page title for the length check', () => {
    expect(codes(page([hero({})], { title: 'x'.repeat(70), seo: { description: 'd' } }))).toEqual([
      'SEO_TITLE_MISSING',
      'SEO_TITLE_LONG',
    ]);
  });
});

describe('ordering and summary', () => {
  it('errors come first; can_publish only without errors', () => {
    const issues = validateContent(
      page([block('Image', { src: '/a.png' }), hero({ ctaHref: '/p/zz' })], { seo: null }),
      ctx()
    );
    const firstWarn = issues.findIndex((i) => i.severity === 'warning');
    expect(issues.slice(0, firstWarn).every((i) => i.severity === 'error')).toBe(true);
    expect(summarize(issues)).toMatchObject({ errors: 1, can_publish: false });
    expect(summarize([{ severity: 'warning' }])).toMatchObject({ errors: 0, warnings: 1, can_publish: true });
  });
});

describe('validatePage (looks up what links and forms can point at)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.prisma.builderPage.findMany.mockResolvedValue([{ slug: 'about' }]);
    h.prisma.templateEngineStage.findMany.mockResolvedValue([
      { outputRef: { pageKeyToId: { services: 'x' } } },
    ]);
    h.prisma.form.findMany.mockResolvedValue([{ slug: 'enquiry' }]);
  });
  it("a link to the page's own slug is fine even before it is published", async () => {
    const r = await validatePage({ ...page([hero({ ctaHref: '/p/spring' })]), project_id: 'p1' });
    expect(r.can_publish).toBe(true);
  });
  it('scopes the lookups to the project, published pages and active forms only', async () => {
    await validatePage({ ...page([hero({})]), project_id: 'p1' });
    expect(h.prisma.builderPage.findMany.mock.calls[0][0].where).toMatchObject({
      status: 'PUBLISHED',
      deleted_at: null,
      project_id: 'p1',
    });
    expect(h.prisma.form.findMany.mock.calls[0][0].where).toMatchObject({
      is_active: true,
      deleted_at: null,
      project_id: 'p1',
    });
  });
  it('finds a broken link using the real lookups', async () => {
    const r = await validatePage({ ...page([hero({ ctaHref: '/p/ghost' })]), project_id: 'p1' });
    expect(r).toMatchObject({ errors: 1, can_publish: false });
  });
});

describe('section schema checks (T7.1)', () => {
  const schemas = {
    Hero: {
      label: 'Hero',
      fields: {
        title: { kind: 'text', tab: 'content' },
        align: { kind: 'select', tab: 'style', options: ['left', 'center'] },
        rounded: { kind: 'toggle', tab: 'style', options: [true, false] },
        cards: { kind: 'list', tab: 'content' },
      },
    },
  };
  const run = (b) => schemaIssues(b, schemas);

  it('an unknown block type is an error (it renders nothing for visitors)', () => {
    const [i] = run({ type: 'Ghost', props: { id: 'g' } });
    expect(i).toMatchObject({ severity: 'error', code: 'BLOCK_UNKNOWN', block_type: 'Ghost' });
  });

  it('valid props, unknown props, empty values and null produce nothing', () => {
    expect(
      run({
        type: 'Hero',
        props: { id: 'h', title: 'Hi', align: 'left', rounded: false, extra: 1, cards: [{}] },
      })
    ).toEqual([]);
    expect(run({ type: 'Hero', props: { id: 'h', title: '', align: null, rounded: undefined } })).toEqual([]);
    expect(run({ type: 'Hero', props: { id: 'h', cards: 'a|b' } })).toEqual([]); // list stored as text lines is accepted
  });

  it('a value outside the options, and wrong value types, are warnings that name the field', () => {
    const issues = run({ type: 'Hero', props: { id: 'h', align: 'diagonal', title: 5, cards: 7 } });
    expect(issues.map((i) => [i.code, i.severity])).toEqual([
      ['FIELD_VALUE_INVALID', 'warning'],
      ['FIELD_TYPE_INVALID', 'warning'],
      ['FIELD_TYPE_INVALID', 'warning'],
    ]);
    expect(issues[0].message).toMatch(/Hero > align: "diagonal"/);
  });

  it('no schemas available (frontend source not mounted): no schema checks at all', () => {
    expect(schemaIssues({ type: 'Ghost', props: {} }, null)).toEqual([]);
  });

  it('validateContent runs them on content blocks, not on header/footer layout blocks', () => {
    const base = { title: 'T', slug: 't', seo: { title: 'T', description: 'd' } };
    const ctx = { pageSlugs: new Set(), siteKeys: new Set(), formSlugs: new Set(), schemas };
    const mixed = validateContent(
      {
        ...base,
        data: {
          content: [
            { type: 'NavBar', props: { id: 'n' } },
            { type: 'Ghost', props: { id: 'g' } },
          ],
        },
      },
      ctx
    );
    expect(mixed.filter((i) => i.code === 'BLOCK_UNKNOWN')).toHaveLength(1); // Ghost yes, NavBar (layout) no
  });

  it('blocks nested in slot props are checked too', () => {
    const base = { title: 'T', slug: 't', seo: { title: 'T', description: 'd' } };
    const ctx = { pageSlugs: new Set(), siteKeys: new Set(), formSlugs: new Set(), schemas };
    const nested = {
      type: 'Hero',
      props: { id: 'outer', title: 'x', slot: [{ type: 'Ghost', props: { id: 'inner' } }] },
    };
    const issues = validateContent({ ...base, data: { content: [nested] } }, ctx);
    expect(issues.find((i) => i.code === 'BLOCK_UNKNOWN')?.block_id).toBe('inner');
  });
});
