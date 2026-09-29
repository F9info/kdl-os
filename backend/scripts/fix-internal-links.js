#!/usr/bin/env node
/**
 * Rewrites the approved mockup's relative links (about.html, work-x.html,
 * #hotel, /products, #quote ...) to the site's real routes, across every
 * page, shared detail-page template and per-item content overlay in a
 * project. Run AFTER the content seeders (they carry the mockup hrefs).
 * Idempotent — already-real links are left alone.
 *
 * Usage: node scripts/fix-internal-links.js <projectId>
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/fix-internal-links.js <projectId>');
  process.exit(1);
}

const BROCHURE = '/seed/subhadra/Subhadra-Group-30-Years-Brochure.pdf';
const pages = await prisma.builderPage.findMany({
  where: { project_id: projectId, deleted_at: null },
  select: { id: true, slug: true, data: true },
});
const pagePath = (suffix) => {
  const p = pages.find((x) => x.slug.endsWith(`-${suffix}`) && x.slug.startsWith('te-'));
  return p ? `/p/${p.slug}` : null;
};
const sectorSlugs = (await prisma.sector.findMany({ where: { project_id: projectId }, select: { slug: true } })).map((s) => s.slug);

const HTML_TO_PAGE = { index: 'home', about: 'about', leadership: 'leadership', contact: 'contact', products: 'products-services', services: 'services', sectors: 'sectors' };
const SITE_PATHS = { '/contact': 'contact', '/products': 'products-services', '/products-services': 'products-services', '/work': 'work', '/sectors': 'sectors', '/about': 'about', '/leadership': 'leadership', '/services': 'services' };
const PRODUCT_SLUG = { switches: 'switches-wiring-devices', lighting: 'lights', fans: 'fans-ventilation', switchgear: 'mcb-db-switchgear' };

function resolve(value) {
  if (typeof value !== 'string' || !value) return value;
  let m;
  if ((m = value.match(/^([a-z0-9-]+)\.html$/i))) {
    const name = m[1];
    if (HTML_TO_PAGE[name]) return pagePath(HTML_TO_PAGE[name]) ?? value;
    if ((m = name.match(/^sector-(.+)$/))) return `/sectors/${m[1]}`;
    if ((m = name.match(/^product-(.+)$/))) return `/catalog/${PRODUCT_SLUG[m[1]] ?? m[1]}`;
    if ((m = name.match(/^work-(.+)$/))) return `/work/${m[1]}`;
    return value;
  }
  if (SITE_PATHS[value]) return pagePath(SITE_PATHS[value]) ?? value;
  if (/^#(quote|book|appointment|v2-quote)$/.test(value)) return '#get-quote';
  if (value === '#brochure') return BROCHURE;
  if (value === '#products') return pagePath('products-services') ?? value;
  if (value.startsWith('#') && sectorSlugs.includes(value.slice(1))) return `/sectors/${value.slice(1)}`;
  return value;
}

const HREF_KEY = /(href|link)$/i;
let changes = 0;
function walk(node, ctx = {}) {
  if (Array.isArray(node)) return node.forEach((x) => walk(x, ctx));
  if (!node || typeof node !== 'object') return;
  // Header: the CTA is "Download Brochure" in the approved design.
  if (node.type === 'ConstructionHeader' && node.props) {
    if (/brochure/i.test(node.props.ctaLabel ?? '') && node.props.ctaHref !== BROCHURE) {
      node.props.ctaHref = BROCHURE;
      changes += 1;
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (typeof v === 'string' && HREF_KEY.test(k) && !/^(logo|image|src)/i.test(k)) {
      const r = k === 'homeHref' && v === '/' ? (pagePath('home') ?? v) : resolve(v);
      if (r !== v) { node[k] = r; changes += 1; }
    } else if (typeof v === 'object') {
      walk(v, ctx);
    }
  }
}

for (const page of pages) {
  const data = structuredClone(page.data);
  const before = changes;
  walk(data);
  // Work pages: "Brands We Use" button scrolls to the brands strip.
  if (page.slug.startsWith('work-detail-')) {
    for (const b of data.content ?? []) {
      if (b.type === 'ConstructionBrandsCarousel' && b.props.anchorId !== 'brands') { b.props.anchorId = 'brands'; changes += 1; }
    }
  }
  if (changes !== before) await prisma.builderPage.update({ where: { id: page.id }, data: { data } });
}
for (const t of await prisma.detailPageTemplate.findMany({ where: { project_id: projectId } })) {
  const data = structuredClone(t.data);
  const before = changes;
  walk(data);
  if (t.type_key === 'sectors') {
    const rows = (data.content ?? []).find((b) => b.type === 'ConstructionDisciplineRows');
    if (rows && rows.props.anchorId !== 'solutions') { rows.props.anchorId = 'solutions'; changes += 1; }
  }
  if (changes !== before) await prisma.detailPageTemplate.update({ where: { id: t.id }, data: { data } });
}
for (const model of ['catalogItem', 'sector']) {
  for (const row of await prisma[model].findMany({ where: { project_id: projectId }, select: { id: true, content: true } })) {
    if (!row.content) continue;
    const content = structuredClone(row.content);
    const before = changes;
    walk(content);
    if (changes !== before) await prisma[model].update({ where: { id: row.id }, data: { content } });
  }
}
// Home "Projects" slider reads these rows, not the page's own slide props.
for (const row of await prisma.projectCaseStudy.findMany({ where: { project_id: projectId } })) {
  const cta = resolve(row.cta_href);
  const link = resolve(row.link_href);
  if (cta !== row.cta_href || link !== row.link_href) {
    await prisma.projectCaseStudy.update({ where: { id: row.id }, data: { cta_href: cta, link_href: link } });
    changes += 1;
  }
}

// Footer "Company" menu = the approved footer's five links (About,
// Leadership, Products & Services, Sectors, Contact) — no dead /privacy-policy.
const footerMenu = await prisma.menu.findFirst({ where: { project_id: projectId, key: { contains: 'footer' } } })
  ?? (await prisma.menu.findFirst({ where: { project_id: projectId, name: 'Footer Navigation' } }));
if (footerMenu) {
  const want = [['About', 'about'], ['Leadership', 'leadership'], ['Products & Services', 'products-services'], ['Sectors', 'sectors'], ['Contact', 'contact']];
  const items = await prisma.menuItem.findMany({ where: { menu_id: footerMenu.id }, orderBy: { order: 'asc' } });
  const same = items.length === want.length && items.every((it, i) => it.label === want[i][0] && it.url === pagePath(want[i][1]));
  if (!same) {
    await prisma.menuItem.deleteMany({ where: { menu_id: footerMenu.id } });
    for (const [i, [label, suffix]] of want.entries()) {
      await prisma.menuItem.create({ data: { menu_id: footerMenu.id, label, link_type: 'custom', url: pagePath(suffix), order: i, is_active: true } });
    }
    changes += 1;
  }
}
console.log(`Rewrote ${changes} link(s).`);
await prisma.$disconnect();
