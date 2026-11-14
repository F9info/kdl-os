import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

const { validateContent } = await import('../page-builder/validate.js');
const { getSectionSchemas } = await import('../../shared/section-schemas.js');
const { TEMPLATE_KEYS, LANDING_TEMPLATES, buildLandingData, formSlugFor, resolveSectionLinks } = await import('./templates.js');

// A template is the first thing a new landing page shows, so it must pass the same publish checks
// as any page the user builds: only real sections, valid choices, links that go somewhere.
const withBody = TEMPLATE_KEYS.filter((k) => k !== 'blank');

describe.each(withBody)('landing template "%s"', (key) => {
  const data = buildLandingData(key, 'spring', 'Spring');
  const issues = validateContent(
    { title: 'Spring', slug: 'spring', seo: { title: 'Spring', description: 'A page about spring.' }, data },
    {
      pageSlugs: new Set(['spring']),
      siteKeys: new Set(),
      formSlugs: new Set([formSlugFor('spring')]),
      schemas: getSectionSchemas(),
    }
  );

  it('passes the page checks with no errors and no warnings', () => {
    expect(issues.map((i) => `${i.severity} ${i.code}: ${i.message}`)).toEqual([]);
  });

  it('is one focused page: no site menu or footer, and a clear call to action', () => {
    const types = data.content.map((b) => b.type);
    expect(types).not.toContain('NavBar');
    expect(types).not.toContain('Footer');
    const hero = data.content.find((b) => b.type === 'LandingHero');
    expect(hero).toBeTruthy();
    const heroCta = Boolean(hero.props.ctaLabel && hero.props.ctaHref);
    expect(heroCta || types.includes('LandingForm') || types.includes('LandingCta')).toBe(true);
  });

  it('creates its enquiry form exactly when it contains a form block', () => {
    const hasFormBlock = data.content.some((b) => ['LandingForm', 'LandingContact'].includes(b.type));
    expect(Boolean(LANDING_TEMPLATES[key].hasForm)).toBe(hasFormBlock);
  });
});

describe.each(TEMPLATE_KEYS)('header of "%s"', (key) => {
  const first = buildLandingData(key, 'spring', 'Spring').content[0];

  it('is the Landing header, with only its menu links and button typed in', () => {
    expect(first.type).toBe('LandingHeader');
    expect(Object.keys(first.props).sort()).toEqual(['ctaHref', 'ctaLabel', 'font', 'id', 'links', 'palette', 'variant']);
  });
});

describe.each(withBody)('footer of "%s"', (key) => {
  const content = buildLandingData(key, 'spring', 'Spring').content;
  const last = content[content.length - 1];

  it('ends with the Landing footer', () => {
    expect(last.type).toBe('LandingFooter');
  });

  it('holds no company details: name, logo, contact and social links come from Identity', () => {
    expect(Object.keys(last.props).sort()).toEqual(['font', 'id', 'links', 'note', 'palette', 'variant']);
    expect(JSON.stringify(last.props)).not.toMatch(/@|tel:|facebook|instagram|linkedin|logo/i);
  });
});

describe('the four demo landing pages look different', () => {
  const DEMO = ['business', 'saas', 'agency', 'startup'];
  const blocks = (type) =>
    DEMO.map((k) => buildLandingData(k, 'x', 'X').content.find((b) => b.type === type).props.variant);

  it('each has its own header design and its own footer design', () => {
    expect(new Set(blocks('LandingHeader')).size).toBe(4);
    expect(new Set(blocks('LandingFooter')).size).toBe(4);
  });

  it('only uses designs the blocks offer (1 to 4)', () => {
    for (const v of [...blocks('LandingHeader'), ...blocks('LandingFooter')]) expect(['1', '2', '3', '4']).toContain(v);
  });

  it('the three pages with a form block use different form designs', () => {
    const forms = DEMO.flatMap((k) => buildLandingData(k, 'x', 'X').content.filter((b) => b.type === 'LandingForm'));
    expect(forms).toHaveLength(3);
    expect(new Set(forms.map((f) => f.props.variant)).size).toBe(3);
  });
});

describe('the starter set', () => {
  const DEMO = ['business', 'saas', 'agency', 'startup'];
  const ORIGINAL = withBody.filter((k) => !DEMO.includes(k));

  it('offers the four original designs plus the four demo pages (Business, SaaS, Agency, Startup)', () => {
    expect(ORIGINAL).toHaveLength(4);
    expect(withBody.filter((k) => DEMO.includes(k))).toHaveLength(4);
  });

  it('gives each template its own hero design so they do not look alike', () => {
    for (const set of [ORIGINAL, DEMO]) {
      const heroVariants = set.map(
        (k) => buildLandingData(k, 's', 'S').content.find((b) => b.type === 'LandingHero').props.variant
      );
      expect(new Set(heroVariants).size).toBe(4);
    }
  });
});

describe('template pictures', () => {
  // Pictures are bundled with the app. A template that points at a missing file would show a broken
  // picture on a brand-new page.
  const publicDir = path.resolve(process.cwd(), '..', 'frontend', 'public');
  const urls = (value) =>
    typeof value === 'string' ? value.split('\n').filter((u) => u.startsWith('/landing-templates/')) : [];
  const referenced = (key) =>
    buildLandingData(key, 's', 'S')
      .content.flatMap((b) => Object.values(b.props))
      .flatMap((v) => [...urls(v), ...(typeof v === 'string' ? v.split('|').flatMap(urls) : [])]);

  it.each(withBody)('every picture used by "%s" exists in frontend/public', (key) => {
    const files = [...new Set(referenced(key))];
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) expect(fs.existsSync(path.join(publicDir, f)), f).toBe(true);
  });
});

describe('header and footer links are resolved against the sections the page has', () => {
  const DEMO = ['business', 'saas', 'agency', 'startup'];
  const chrome = (content) => content.filter((b) => ['LandingHeader', 'LandingFooter'].includes(b.type));
  const links = (b) => b.props.links.split('\n').filter(Boolean).map((l) => l.split('|'));

  it.each(DEMO)('"%s": every link lands on an anchor that exists on the page, and none is a dead "#"', (key) => {
    const content = buildLandingData(key, 'x', 'X').content;
    const anchors = new Set(content.map((b) => b.props.anchor).filter(Boolean));
    for (const b of chrome(content)) {
      for (const [label, href] of links(b)) {
        if (label === 'Back to top') continue;
        expect(href, `${key} ${b.type} "${label}"`).toMatch(/^#.+/);
        expect(anchors.has(href.slice(1)), `${key} ${b.type} "${label}" -> ${href}`).toBe(true);
      }
    }
  });

  it('the header and footer of one page share the anchor of the same section', () => {
    const content = buildLandingData('business', 'x', 'X').content;
    const [header, footer] = chrome(content);
    const h = Object.fromEntries(links(header));
    const f = Object.fromEntries(links(footer));
    expect(h.About).toBe(f.About);
    expect(h.Services).toBe(f.Services);
  });

  it('drops a link whose section is not on the page, keeps plain links as written, and keeps an existing anchor', () => {
    const blocks = [
      { type: 'LandingHeader', props: { links: 'Pricing|@LandingPricing\nHome|/\nTalk|@LandingContact,LandingForm' } },
      { type: 'LandingForm', props: { anchor: 'contact' } },
      { type: 'LandingFooter', props: { links: 'Top|#' } },
    ];
    const out = resolveSectionLinks(blocks);
    expect(out[0].props.links).toBe('Home|/\nTalk|#contact');
    expect(out[2].props.links).toBe('Top|#');
  });
});
