#!/usr/bin/env node
/**
 * Re-apply the client-approved Subhadra Group "About" page
 * content (seed-data/about-content.json, extracted once from
 * after-delete-folder/products.html — not re-parsed at runtime)
 * onto the project's real BuilderPage. Idempotent — safe to re-run any time
 * the content JSON changes. Keeps that page's own Header/Footer blocks
 * untouched (first/last content entries), replaces everything in between.
 *
 * Usage:
 *   node scripts/seed-about-content.js
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { prisma } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SLUG = 'te-cmt18teqh000101rxwfzfndow-about';

const middleBlocks = JSON.parse(
  readFileSync(path.join(__dirname, 'seed-data/about-content.json'), 'utf8')
);

const page = await prisma.builderPage.findUnique({ where: { slug: SLUG } });
if (!page) {
  throw new Error(`BuilderPage ${SLUG} not found`);
}

const content = page.data?.content ?? [];
const header = content.find((b) => b.type === 'ConstructionHeader');
const footer = content.find((b) => b.type === 'ConstructionFooter');

const newContent = [...(header ? [header] : []), ...middleBlocks, ...(footer ? [footer] : [])];

await prisma.builderPage.update({
  where: { id: page.id },
  data: { data: { ...page.data, content: newContent } },
});

console.log(`Updated BuilderPage ${SLUG}: ${newContent.length} blocks.`);
await prisma.$disconnect();
