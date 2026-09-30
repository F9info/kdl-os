#!/usr/bin/env node
/**
 * Re-apply the client-approved Subhadra Group Home page content
 * (seed-data/home-content.json, from after-delete-folder/index.html — not
 * re-parsed at runtime) onto the project's Home BuilderPage, looked up by
 * slug. Keeps the page's own Header/Footer blocks (first/last), replaces
 * everything between. Also puts the Projects Content case studies in the
 * mockup's slider order (the slider reads that module, not its own slides).
 * Idempotent.
 *
 * Usage: node scripts/seed-home-content.js
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { prisma } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'te-cmt18teqh000101rxwfzfndow-home';
const CASE_STUDY_ORDER = ['The Amara Residency', 'Novotel Visakhapatnam', 'CMR Family Shopping Mall'];

const middleBlocks = JSON.parse(
  readFileSync(path.join(__dirname, 'seed-data/home-content.json'), 'utf8')
);

const page = await prisma.builderPage.findFirst({ where: { slug: SLUG, deleted_at: null } });
if (!page) throw new Error(`BuilderPage ${SLUG} not found`);

const content = page.data?.content ?? [];
const header = content.find((b) => b.type === 'ConstructionHeader');
const footer = content.find((b) => b.type === 'ConstructionFooter');
const newContent = [...(header ? [header] : []), ...middleBlocks, ...(footer ? [footer] : [])];

await prisma.builderPage.update({
  where: { id: page.id },
  data: { data: { ...page.data, content: newContent } },
});

for (const [order, title] of CASE_STUDY_ORDER.entries()) {
  await prisma.projectCaseStudy.updateMany({
    where: { project_id: page.project_id, title },
    data: { order },
  });
}

console.log(`Updated BuilderPage ${page.id}: ${newContent.length} blocks.`);
await prisma.$disconnect();
