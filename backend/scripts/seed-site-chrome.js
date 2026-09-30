#!/usr/bin/env node
/**
 * Apply the client-approved footer copy (backend/scripts/seed-data/
 * site-chrome.json, taken from the approved index.html) to every
 * ConstructionFooter block in a project — each page and each shared
 * detail-page template carries its own copy of the site chrome.
 * Idempotent.
 *
 * Usage: node scripts/seed-site-chrome.js <projectId>
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../src/config/database.js';

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/seed-site-chrome.js <projectId>');
  process.exit(1);
}
const chrome = JSON.parse(
  readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data/site-chrome.json'), 'utf8')
);

function patch(data, overBanner = false) {
  let changed = false;
  for (const block of data?.content ?? []) {
    // Detail pages open with a full-bleed banner; the approved mockups float
    // the header over it (light text, no background).
    if (overBanner && block.type === 'ConstructionHeader') {
      for (const [k, v] of Object.entries(chrome.headerOverBanner)) {
        if (block.props[k] !== v) { block.props[k] = v; changed = true; }
      }
    }
    if (block.type !== 'ConstructionFooter') continue;
    for (const [k, v] of Object.entries(chrome.footer)) {
      if (block.props[k] !== v) {
        block.props[k] = v;
        changed = true;
      }
    }
  }
  return changed;
}

let n = 0;
for (const page of await prisma.builderPage.findMany({ where: { project_id: projectId, deleted_at: null } })) {
  const data = structuredClone(page.data);
  if (patch(data, page.slug.startsWith('work-detail-'))) { await prisma.builderPage.update({ where: { id: page.id }, data: { data } }); n += 1; }
}
for (const tpl of await prisma.detailPageTemplate.findMany({ where: { project_id: projectId } })) {
  const data = structuredClone(tpl.data);
  if (patch(data, true)) { await prisma.detailPageTemplate.update({ where: { id: tpl.id }, data: { data } }); n += 1; }
}
console.log(`Patched footer on ${n} page/template row(s).`);
await prisma.$disconnect();
