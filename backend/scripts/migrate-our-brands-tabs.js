#!/usr/bin/env node
/**
 * ConstructionOurBrands moved from tab1Label/tab1Groups… text fields to a
 * `tabs` accordion (tab → categories → brand logos). Converts every saved page
 * and detail-page template still on the old shape, and the seed-data JSON files
 * (pass --seed-files). Idempotent: blocks that already have `tabs` are skipped.
 *
 * Usage: node scripts/migrate-our-brands-tabs.js [--seed-files]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../src/config/database.js';

const LEGACY_KEYS = ['tab1Label', 'tab1Groups', 'tab2Label', 'tab2Groups', 'tab3Label', 'tab3Groups'];

const parseCategories = (raw = '') =>
  raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [heading, brandsRaw = ''] = line.split('|');
      return {
        heading: (heading ?? '').trim(),
        brands: brandsRaw
          .split(';')
          .map((b) => b.trim())
          .filter(Boolean)
          .map((entry) => {
            const [name, logo] = entry.split('::');
            return { name: (name ?? '').trim(), logo: (logo ?? '').trim() };
          })
          .filter((b) => b.name),
      };
    })
    .filter((c) => c.heading);

/** Returns true if the block was converted. */
export function migrateBlock(block) {
  if (block?.type !== 'ConstructionOurBrands' || block.props?.tabs?.length) return false;
  const p = block.props ?? {};
  const tabs = [1, 2, 3]
    .map((n) => ({ label: p[`tab${n}Label`] ?? '', categories: parseCategories(p[`tab${n}Groups`]) }))
    .filter((t) => t.label);
  if (!tabs.length) return false;
  block.props = Object.fromEntries(Object.entries({ ...p, tabs }).filter(([k]) => !LEGACY_KEYS.includes(k)));
  return true;
}

const migrateData = (data) => (data?.content ?? []).reduce((n, b) => n + (migrateBlock(b) ? 1 : 0), 0);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let blocks = 0;
  for (const model of ['builderPage', 'detailPageTemplate']) {
    for (const row of await prisma[model].findMany({ select: { id: true, data: true } })) {
      const n = migrateData(row.data);
      if (n) {
        await prisma[model].update({ where: { id: row.id }, data: { data: row.data } });
        blocks += n;
      }
    }
  }
  console.log(`migrated ${blocks} ConstructionOurBrands block(s) in the database`);

  if (process.argv.includes('--seed-files')) {
    const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data');
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
      const file = path.join(dir, f);
      const json = JSON.parse(readFileSync(file, 'utf8'));
      const n = Array.isArray(json) ? json.reduce((a, b) => a + (migrateBlock(b) ? 1 : 0), 0) : 0;
      if (n) {
        writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
        console.log(`seed file ${f}: ${n} block(s)`);
      }
    }
  }
  await prisma.$disconnect();
}
