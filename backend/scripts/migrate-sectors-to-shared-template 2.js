#!/usr/bin/env node
/**
 * One-time backfill: point every existing sector's BuilderPage at one shared
 * DetailPageTemplate row (created from Showrooms' current page — the
 * project's most-developed sector page) instead of each page's own frozen
 * `data` copy. After this runs, editing structure on ANY sector's page
 * writes through to the same template row, and every sibling sector
 * re-resolves from it — see
 * docs/superpowers/specs/2026-09-28-details-page-shared-layout-design.md.
 *
 * Idempotent — upserts the template row and re-points every sector's page
 * every run; safe to re-run.
 *
 * Usage:
 *   node scripts/migrate-sectors-to-shared-template.js <projectId>
 */
import 'dotenv/config';
import { prisma } from '../src/config/database.js';

const projectId = process.argv[2];
if (!projectId) {
  console.error('Usage: node scripts/migrate-sectors-to-shared-template.js <projectId>');
  process.exit(1);
}

const sectors = await prisma.sector.findMany({
  where: { project_id: projectId, detail_page_id: { not: null } },
  orderBy: [{ order: 'asc' }, { created_at: 'asc' }],
});

if (sectors.length === 0) {
  console.log('No sectors with a page found for this project — nothing to migrate.');
  process.exit(0);
}

const representative = sectors[0];
const repPage = await prisma.builderPage.findUnique({ where: { id: representative.detail_page_id } });
if (!repPage) {
  console.error(`Representative sector "${representative.name}" has no BuilderPage — aborting.`);
  process.exit(1);
}

const template = await prisma.detailPageTemplate.upsert({
  where: { project_id_type_key: { project_id: projectId, type_key: 'sectors' } },
  update: { data: repPage.data },
  create: { project_id: projectId, type_key: 'sectors', data: repPage.data },
});

for (const sector of sectors) {
  await prisma.builderPage.update({
    where: { id: sector.detail_page_id },
    data: { template_id: template.id, entity_id: sector.id },
  });
}

console.log(
  `Migrated ${sectors.length} sector page(s) onto template ${template.id} (structure from "${representative.name}").`
);
await prisma.$disconnect();
