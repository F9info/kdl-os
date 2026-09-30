#!/usr/bin/env node
/**
 * Patch the Subhadra Group "Sectors" list page so its banner headline and
 * lead form match the client-approved after-delete-folder/sectors.html.
 * Idempotent; looks the page up by slug and only touches the two blocks
 * below (Header/Footer and the rest are left alone). The sector cards
 * themselves come from the Sector module (ConstructionSectorDetailList).
 *
 * Usage:
 *   node scripts/seed-sectors-page-content.js
 */
import 'dotenv/config';

import { prisma } from '../src/config/database.js';

const SLUG = 'te-cmt18teqh000101rxwfzfndow-sectors';

const PATCH = {
  ConstructionInnerBanner: { headline: 'Solutions for every space' },
  ConstructionLeadFormFAQ: {
    introText:
      'Share a few details and our engineers will get back to you with the right solution and a quote — usually within 24 hours.',
    showFaqs: false, // the approved page has no FAQ list next to the form
    faqSource: 'block',
  },
};

const page = await prisma.builderPage.findUnique({ where: { slug: SLUG } });
if (!page) throw new Error(`BuilderPage ${SLUG} not found`);

const content = (page.data?.content ?? []).map((b) =>
  PATCH[b.type] ? { ...b, props: { ...b.props, ...PATCH[b.type] } } : b
);

await prisma.builderPage.update({
  where: { id: page.id },
  data: { data: { ...page.data, content } },
});

console.log(`Updated BuilderPage ${SLUG}.`);
await prisma.$disconnect();
