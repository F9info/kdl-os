import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const findMany = vi.fn(async () => []);
vi.mock('../../../config/database.js', () => ({
  prisma: {
    project: { findFirst: async () => ({ id: 'p1', slug: 's', name: 'S' }) },
    brandKit: { findUnique: async () => null },
    builderPage: { findMany: (a) => findMany(a) },
    menu: { findMany: async () => [] },
    detailPageTemplate: { findMany: async () => [] },
    siteLayout: { findUnique: async () => ({ top_header: {}, header: { enabled: true, variant: '3' }, footer: {} }) },
  },
}));
vi.mock('../../identity/company-info.js', () => ({ getCompanyInfo: async () => null }));

const { buildSiteModel, buildLandingModel, collectSiteInput } = await import('./generator.js');
const { normalizeSiteUrl, seoFiles, writeExportContent, bakeIdentity } = await import('./export-content.js');

const slugOf = (k) => `te-c${'a'.repeat(24)}-${k}`;
const page = (id, title, key, seo = null) => ({ id, title, slug: slugOf(key), status: 'PUBLISHED', seo, data: { content: [] } });
const item = (id, label, o = {}) => ({ id, label, is_active: true, order: 0, parent_id: null, page_id: null, url: null, no_page: false, open_in_new_tab: false, ...o });

describe('static export content (T14)', () => {
  it('asks the database for every published page, website and landing, when exporting', async () => {
    await collectSiteInput('p1', { publishedOnly: true });
    expect(findMany.mock.calls.at(-1)[0].where).toMatchObject({
      project_id: 'p1',
      deleted_at: null,
      status: 'PUBLISHED',
    });
    expect(findMany.mock.calls.at(-1)[0].where).not.toHaveProperty('OR');
    await collectSiteInput('p1');
    expect(findMany.mock.calls.at(-1)[0].where).not.toHaveProperty('status');
  });

  it('carries the saved header/footer layout into site.json so every page can apply it', async () => {
    const input = await collectSiteInput('p1');
    expect(input.layout).toEqual({ header: { enabled: true, variant: '3' } });
    expect(buildSiteModel(input).site.layout).toEqual({ header: { enabled: true, variant: '3' } });
  });

  it('an export drops menu links to pages that are not in it; the live model keeps them', () => {
    const input = {
      project: { id: 'p1', slug: 's', name: 'S' },
      pages: [page('a', 'Home', 'home'), page('b', 'About', 'about')],
      menus: [{ key: 'header', items: [
        item('1', 'About', { page_id: 'b' }),
        item('2', 'Draft page', { page_id: 'gone' }),
        item('3', 'Old link', { url: `/p/${slugOf('missing')}` }),
        item('4', 'Heading', { no_page: true }),
        item('5', 'External', { url: 'https://example.com' }),
      ] }],
    };
    const labels = (m) => m.menus.header.map((i) => i.label);
    expect(labels(buildSiteModel(input, { exportOnly: true }))).toEqual(['About', 'Heading', 'External']);
    expect(labels(buildSiteModel(input))).toHaveLength(5);
  });

  it('carries each page\'s SEO into its JSON', () => {
    const seo = { title: 'T', description: 'D' };
    const m = buildSiteModel({ project: { id: 'p1', slug: 's', name: 'S' }, pages: [page('a', 'Home', 'home', seo)], menus: [] });
    expect(m.pages[0].json.seo).toEqual(seo);
  });

  it('normalizes the site address and refuses anything that is not plain http(s)', () => {
    expect(normalizeSiteUrl('https://www.example.com/some/path?x=1')).toBe('https://www.example.com');
    expect(normalizeSiteUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeSiteUrl('https://user:pw@example.com')).toBeNull();
    expect(normalizeSiteUrl('')).toBeNull();
  });

  it('robots.txt always; sitemap only with an address, without noindex pages, XML-escaped', () => {
    const model = buildSiteModel({
      project: { id: 'p1', slug: 's', name: 'S' },
      pages: [page('a', 'Home', 'home'), page('b', 'About', 'about'), page('c', 'Secret', 'secret', { noindex: true })],
      menus: [],
    });
    const none = seoFiles(model, null);
    expect(none.robots).toContain('User-agent: *');
    expect(none.robots).not.toContain('Sitemap');
    expect(none.sitemap).toBeNull();
    const withUrl = seoFiles(model, 'https://x.test');
    expect(withUrl.robots).toContain('Sitemap: https://x.test/sitemap.xml');
    expect(withUrl.sitemap).toContain('<loc>https://x.test/</loc>');
    expect(withUrl.sitemap).toContain('<loc>https://x.test/about</loc>');
    expect(withUrl.sitemap).not.toContain('secret');
  });

  it('writes content-export/ and the SEO files into the site folder, and removes a stale sitemap', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-export-'));
    try {
      const model = buildSiteModel({ project: { id: 'p1', slug: 's', name: 'S' }, pages: [page('a', 'Home', 'home')], menus: [] });
      await writeExportContent(root, model, 'https://x.test');
      expect(JSON.parse(await fs.readFile(path.join(root, 'content-export/site.json'), 'utf8')).siteUrl).toBe('https://x.test');
      expect(await fs.readdir(path.join(root, 'content-export/pages'))).toEqual(['index.json']);
      expect(await fs.readFile(path.join(root, 'static-assets/sitemap.xml'), 'utf8')).toContain('https://x.test/');
      await writeExportContent(root, model, '');
      await expect(fs.access(path.join(root, 'static-assets/sitemap.xml'))).rejects.toThrow();
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  describe('landing pages in the export', () => {
    const landing = (id, title, slug, overrides = null) => ({ id, title, slug, status: 'PUBLISHED', seo: null, data: { content: [] }, landing: true, identityOverrides: overrides });
    const input = (pages) => ({ project: { id: 'p1', slug: 's', name: 'S' }, pages, menus: [] });

    it('a landing page is routed by its slug, even when it is titled Home or has a website page\'s name', () => {
      const m = buildSiteModel(input([page('a', 'Home', 'home'), landing('l1', 'Home', 'sri-lakshmi-developers'), landing('l2', 'About', 'about')]), { exportOnly: true });
      const routes = Object.fromEntries(m.pages.map((p) => [p.json.slug, p.json.route]));
      expect(routes[slugOf('home')]).toBe('');
      expect(routes['sri-lakshmi-developers']).toBe('sri-lakshmi-developers');
      expect(routes.about).toBe('about');
    });

    it('a /p/<landing-slug> link in a page points at the landing page address', () => {
      const withLink = { ...page('a', 'Home', 'home'), data: { content: [{ props: { href: '/p/sri-lakshmi-developers' } }] } };
      const m = buildSiteModel(input([withLink, landing('l1', 'Sri', 'sri-lakshmi-developers')]), { exportOnly: true });
      expect(m.pages[0].json.data.content[0].props.href).toBe('/sri-lakshmi-developers');
    });

    it('one landing page exported on its own: it is the front page, alone, in a folder named after it', () => {
      const a = { ...landing('l1', 'Sri Lakshmi', 'sri-lakshmi-developers'), siteId: 'siteA' };
      const b = { ...landing('l2', 'Other', 'other'), siteId: 'siteB' };
      const m = buildLandingModel(input([page('h', 'Home', 'home'), a, b]), 'siteA');
      expect(m.pages.map((p) => [p.file, p.json.route, p.json.slug])).toEqual([['index', '', 'sri-lakshmi-developers']]);
      expect(m.site.slug).toBe('s-sri-lakshmi-developers'); // <project slug>-<landing slug>: a folder per landing page
      expect(m.site.name).toBe('Sri Lakshmi');
      expect(m.menus).toEqual({ header: [], footer: [] });
      expect(buildLandingModel(input([a]), 'siteB')).toBeNull(); // not saved (live) yet: nothing to convert
      expect(buildLandingModel(input([a, b]), 'siteB').site.slug).toBe('s-other'); // the second page has its own folder
    });

    it('bakes the identity: overrides win, empty overrides do not, and a stored logo is copied into the folder', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-bake-'));
      try {
        const read = vi.fn(async (p) => (p === 'identity/logo.png' ? Buffer.from('PNG') : null));
        const out = await bakeIdentity(root, { company_name: 'KDL', company_logo_light: 'identity/logo.png', logo_light: 'https://cdn.test/a.png', contact_phone: '1' }, { company_name: 'Sri Lakshmi Developers', contact_phone: '  ' }, read);
        expect(out.company_name).toBe('Sri Lakshmi Developers');
        expect(out.contact_phone).toBe('1');
        expect(out.logo_light).toBe('https://cdn.test/a.png'); // an address stays as it is
        expect(out.company_logo_light).toMatch(/^\/media\/[0-9a-f]{16}\.png$/);
        expect(await fs.readFile(path.join(root, 'static-assets', out.company_logo_light), 'utf8')).toBe('PNG');
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('a logo that cannot be read is dropped (no dead link); a page\'s own logo hides the project\'s dark one', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-bake-'));
      try {
        const out = await bakeIdentity(root, { company_logo_light: 'gone.png', logo_dark: 'dark.png' }, { logo_light: 'https://x/own.png' }, async () => null);
        expect(out.company_logo_light).toBe('');
        expect('logo_dark' in out).toBe(false);
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });

    it('writes a landing page with its baked identity and without the raw overrides; website pages get none', async () => {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'kdl-export-'));
      try {
        const m = buildSiteModel(input([page('a', 'Home', 'home'), landing('l1', 'Sri', 'sri', { company_name: 'Sri Lakshmi Developers' })]), { exportOnly: true });
        await writeExportContent(root, m, '', { identity: { company_name: 'KDL', contact_email: 'a@b.test' } });
        const read = async (f) => JSON.parse(await fs.readFile(path.join(root, 'content-export/pages', f), 'utf8'));
        const l = await read('sri.json');
        expect(l.identity).toEqual({ company_name: 'Sri Lakshmi Developers', contact_email: 'a@b.test' });
        expect(l).not.toHaveProperty('identityOverrides');
        expect(await read('index.json')).not.toHaveProperty('identity');
        const routes = JSON.parse(await fs.readFile(path.join(root, 'content-export/routes.json'), 'utf8'));
        expect(routes.bySlug.sri).toBe('sri');
      } finally {
        await fs.rm(root, { recursive: true, force: true });
      }
    });
  });
});
