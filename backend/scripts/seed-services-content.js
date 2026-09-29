#!/usr/bin/env node
/**
 * Re-apply the client-approved Subhadra Group "Services" page
 * content (seed-data/services-content.json, extracted once from
 * after-delete-folder/products.html — not re-parsed at runtime)
 * onto the project's real BuilderPage. Idempotent — safe to re-run any time
 * the content JSON changes. Keeps that page's own Header/Footer blocks
 * untouched (first/last content entries), replaces everything in between.
 *
 * Usage:
 *   node scripts/seed-services-content.js
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { prisma } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'te-cmt18teqh000101rxwfzfndow-services';

const middleBlocks = JSON.parse(
  readFileSync(path.join(__dirname, 'seed-data/services-content.json'), 'utf8')
);

const page = await prisma.builderPage.findUnique({ where: { slug: SLUG } });
if (!page) {
  throw new Error(`BuilderPage ${SLUG} not found`);
}

const content = page.data?.content ?? [];
let header = content.find((b) => b.type === 'ConstructionHeader');
let footer = content.find((b) => b.type === 'ConstructionFooter');
// The Services page was created from a generic template (no Construction
// chrome) — borrow the About page's header/footer so it matches the site.
if (!header || !footer) {
  const about = await prisma.builderPage.findFirst({
    where: { slug: 'te-cmt18teqh000101rxwfzfndow-about' },
  });
  const ac = about?.data?.content ?? [];
  const h = ac.find((b) => b.type === 'ConstructionHeader');
  const f = ac.find((b) => b.type === 'ConstructionFooter');
  header ??= h && { ...h, props: { ...h.props, id: 'services-ConstructionHeader' } };
  footer ??= f && { ...f, props: { ...f.props, id: 'services-ConstructionFooter' } };
}

const newContent = [...(header ? [header] : []), ...middleBlocks, ...(footer ? [footer] : [])];

await prisma.builderPage.update({
  where: { id: page.id },
  data: { data: { ...page.data, content: newContent } },
});

console.log(`Updated BuilderPage ${SLUG}: ${newContent.length} blocks.`);
await prisma.$disconnect();
