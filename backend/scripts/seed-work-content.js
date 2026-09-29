#!/usr/bin/env node
/**
 * Apply client-approved Work detail page content (seed-data/work-content.json)
 * onto each work category's BuilderPage. Keeps the page's Header/Footer and
 * (for central-ac) its existing client rows; rebuilds the rest. Idempotent.
 *
 * Usage: node scripts/seed-work-content.js
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/config/database.js';

const cfg = JSON.parse(readFileSync(new URL('./seed-data/work-content.json', import.meta.url), 'utf8'));
const ctaProps = {
  ctaLabel: 'Talk to Us →',
  ctaHref: '/contact',
  secondaryCtaLabel: 'See Products',
  secondaryCtaHref: '/products',
  phoneNumber: '',
  phoneLabel: '',
  background: 'muted',
};

for (const [slug, c] of Object.entries(cfg.pages)) {
  const pageSlug = `work-detail-${cfg.projectId}-${slug}`;
  const page = await prisma.builderPage.findFirst({ where: { slug: pageSlug, deleted_at: null } });
  if (!page) { console.warn(`skip ${slug}: page ${pageSlug} not found`); continue; }
  const content = page.data.content;
  const header = content.find((b) => b.type === 'ConstructionHeader');
  const footer = content.find((b) => b.type === 'ConstructionFooter');
  const banner = content.find((b) => b.type === 'ConstructionInnerBanner');
  const rows = content.find((b) => b.type === 'ConstructionDisciplineRows');

  Object.assign(banner.props, c.banner, {
    ctaPrimaryLabel: 'Get a Quote →',
    ctaPrimaryHref: '/contact',
    ctaSecondaryLabel: 'Brands We Use',
    ctaSecondaryHref: '#brands',
  });

  const brands = {
    type: 'ConstructionBrandsCarousel',
    props: {
      id: `${slug}-brands`,
      sectionTitle: c.brandsTitle,
      logos: c.brands.map((b) => ({ logo: b.src })),
      padding: 'md',
      background: 'muted',
    },
  };
  const cta = (extra) => ({ type: 'ConstructionQuoteCTA', props: { id: `${slug}-cta`, headline: '', subtext: '', ...ctaProps, ...extra } });

  let middle;
  if (c.stub) {
    // Stub mockups: heading + blurb + 2 CTAs, then brands.
    middle = [banner, cta({ headline: c.stub.headline, subtext: c.stub.subtext }), brands];
  } else {
    Object.assign(rows.props, c.gallery);
    middle = [banner, rows, brands, cta({ background: 'white' })];
  }
  const data = { ...page.data, content: [...(header ? [header] : []), ...middle, ...(footer ? [footer] : [])] };
  await prisma.builderPage.update({ where: { id: page.id }, data: { data } });
  console.log(`updated ${slug}`);
}
await prisma.$disconnect();
