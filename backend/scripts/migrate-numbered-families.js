#!/usr/bin/env node
/**
 * Converts numbered-slot block props (faq1Question…) to array props everywhere they are stored:
 * builder pages, detail-page templates, per-sector content overrides, and (with --seed-files) the
 * seed-data JSON the seed scripts replay. Table: frontend/.../packs/numbered-families.json.
 * Idempotent. Before overwriting, rows are dumped to --backup=<file> (default ./numbered-families-backup.json).
 *
 * Usage: node scripts/migrate-numbered-families.js [--dry-run] [--seed-files] [--files-only] [--backup=file]
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { prisma } from '../src/config/database.js';
import { normalizeBlockProps, normalizeData } from '../src/shared/numbered-families.js';

const dry = process.argv.includes('--dry-run');
const backupFile = process.argv.find((a) => a.startsWith('--backup='))?.split('=')[1] ?? 'numbered-families-backup.json';
const backup = [];
const report = { builderPage: 0, detailPageTemplate: 0, sector: 0, seedFiles: 0 };

const filesOnly = process.argv.includes('--files-only');
for (const model of filesOnly ? [] : ['builderPage', 'detailPageTemplate']) {
  for (const row of await prisma[model].findMany({ select: { id: true, data: true } })) {
    const next = normalizeData(row.data);
    if (next === row.data) continue;
    backup.push({ model, id: row.id, data: row.data });
    report[model] += 1;
    if (!dry) await prisma[model].update({ where: { id: row.id }, data: { data: next } });
  }
}

// Sector overrides are keyed by block-id suffix, so block types come from the shared sector template.
const suffixOf = (id) => id.slice(id.indexOf('-') + 1);
const templates = filesOnly ? [] : await prisma.detailPageTemplate.findMany({ select: { project_id: true, data: true } });
const typeBySuffix = new Map();
for (const t of templates) {
  for (const b of t.data?.content ?? []) if (b.props?.id) typeBySuffix.set(suffixOf(b.props.id), b.type);
}
for (const sector of filesOnly ? [] : await prisma.sector.findMany({ select: { id: true, content: true } })) {
  if (!sector.content || typeof sector.content !== 'object') continue;
  let changed = false;
  const content = {};
  for (const [suffix, props] of Object.entries(sector.content)) {
    const next = normalizeBlockProps(typeBySuffix.get(suffix), props);
    content[suffix] = next;
    if (next !== props) changed = true;
  }
  if (!changed) continue;
  backup.push({ model: 'sector', id: sector.id, content: sector.content });
  report.sector += 1;
  if (!dry) await prisma.sector.update({ where: { id: sector.id }, data: { content } });
}

if (process.argv.includes('--seed-files')) {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-data');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const file = path.join(dir, f);
    const json = JSON.parse(readFileSync(file, 'utf8'));
    // seed files are either a block list or { content: [...] }
    const wrapped = Array.isArray(json) ? { content: json } : json;
    if (!Array.isArray(wrapped.content)) continue;
    const next = normalizeData(wrapped);
    if (next === wrapped) continue;
    report.seedFiles += 1;
    if (!dry) writeFileSync(file, JSON.stringify(Array.isArray(json) ? next.content : next, null, 2) + '\n');
  }
}

if (backup.length && !dry) writeFileSync(backupFile, JSON.stringify(backup));
console.log(dry ? 'dry run —' : 'migrated —', JSON.stringify(report), backup.length && !dry ? `backup: ${backupFile}` : '');
if (!filesOnly) await prisma.$disconnect();
