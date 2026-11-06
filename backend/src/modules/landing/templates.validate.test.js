import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../config/database.js', () => ({ prisma: {} }));

const { validateContent } = await import('../page-builder/validate.js');
const { getSectionSchemas } = await import('../../shared/section-schemas.js');
const { TEMPLATE_KEYS, LANDING_TEMPLATES, buildLandingData, formSlugFor } = await import('./templates.js');

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
    const hasFormBlock = data.content.some((b) => b.type === 'LandingForm');
    expect(Boolean(LANDING_TEMPLATES[key].hasForm)).toBe(hasFormBlock);
  });
});

describe.each(withBody)('footer of "%s"', (key) => {
  const content = buildLandingData(key, 'spring', 'Spring').content;
  const last = content[content.length - 1];

  it('ends with the Landing footer', () => {
    expect(last.type).toBe('LandingFooter');
  });

  it('holds no company details: name, logo, contact and social links come from Identity', () => {
    expect(Object.keys(last.props).sort()).toEqual(['font', 'id', 'links', 'note', 'palette']);
    expect(JSON.stringify(last.props)).not.toMatch(/@|tel:|facebook|instagram|linkedin|logo/i);
  });
});

describe('the starter set', () => {
  it('offers four different designs besides Blank', () => {
    expect(withBody).toHaveLength(4);
  });

  it('gives each template its own hero design so they do not look alike', () => {
    const heroVariants = withBody.map(
      (k) => buildLandingData(k, 's', 'S').content.find((b) => b.type === 'LandingHero').props.variant
    );
    expect(new Set(heroVariants).size).toBe(4);
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
