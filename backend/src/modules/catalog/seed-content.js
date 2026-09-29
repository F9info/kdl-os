import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createCatalog, starterPageContent } from './service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Client-approved catalog content for Subhadra Group, extracted once from
// the approved static-HTML mockup (after-delete-folder/products-services.html)
// — see scripts/seed-data/catalog-items-content.json. Not re-parsed at
// runtime; that folder is scratch/temporary.
const ITEMS = JSON.parse(
  readFileSync(path.join(__dirname, '../../../scripts/seed-data/catalog-items-content.json'), 'utf8')
);

// Per-item page copy (banner, overview, applications, why-buy, process, quote
// form), extracted from after-delete-folder/product-*.html by
// scripts/extract-catalog-page-content.py. Keyed by catalog slug, then by
// Puck block type. Items without a mockup page (central-vrf-ac,
// home-automation, home-theater) have no entry and keep the plain layout.
const PAGE_CONTENT = JSON.parse(
  readFileSync(path.join(__dirname, '../../../scripts/seed-data/catalog-page-content.json'), 'utf8')
);

// Idempotent: creates any item (by slug, scoped to the project) that
// doesn't exist yet, keeps existing ones untouched (their own name/
// description/image/brand_tag win over re-running this — same as sectors'
// seeder never overwrites hand-edited entity fields, only fills gaps).
export async function seedCatalogItems(prisma, projectId, actorId) {
  const existing = await prisma.catalogItem.findMany({
    where: { project_id: projectId },
    select: { slug: true },
  });
  const existingSlugs = new Set(existing.map((e) => e.slug));

  let created = 0;
  for (const [index, item] of ITEMS.entries()) {
    if (existingSlugs.has(item.slug)) continue;
    await createCatalog(
      {
        project_id: projectId,
        name: item.name,
        slug: item.slug,
        category: item.category,
        description: item.description,
        image: item.image,
        brand_tag: item.brand_tag,
        order: index,
        is_active: true,
      },
      actorId
    );
    created += 1;
  }

  // Per-item section copy: always re-applied (the approved mockup is the
  // source of truth for this column; hand-edits belong in the template).
  const items = await prisma.catalogItem.findMany({ where: { project_id: projectId } });
  for (const item of items) {
    const content = PAGE_CONTENT[item.slug];
    if (content) await prisma.catalogItem.update({ where: { id: item.id }, data: { content } });
  }

  // Upgrade the shared template from the old banner+form starter to the full
  // section layout. Only when it still lacks the new sections, so a template
  // an admin has already reshaped is never overwritten.
  const template = await prisma.detailPageTemplate.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: 'catalog' } },
  });
  if (template && !template.data.content?.some((b) => b.type === 'ConstructionDisciplineRows')) {
    const rep = items.find((i) => PAGE_CONTENT[i.slug]) ?? items[0];
    await prisma.detailPageTemplate.update({
      where: { id: template.id },
      data: { data: await starterPageContent(rep) },
    });
  }

  // Design variants matching the approved product-page look (square orange
  // icon tiles, tall-photo "why" split, shadow step cards). Only fills a
  // variant that was never chosen, so an admin's own design pick stays.
  const tpl = await prisma.detailPageTemplate.findUnique({
    where: { project_id_type_key: { project_id: projectId, type_key: 'catalog' } },
  });
  if (tpl) {
    const data = structuredClone(tpl.data);
    let changed = false;
    for (const b of data.content ?? []) {
      if (
        ['ConstructionIconFeatureGrid', 'ConstructionApproachSplit', 'ConstructionProcessSteps'].includes(b.type) &&
        b.props.variant === undefined
      ) {
        b.props.variant = '2';
        if (b.type === 'ConstructionApproachSplit') b.props.background = 'white';
        changed = true;
      }
    }
    if (changed) await prisma.detailPageTemplate.update({ where: { id: tpl.id }, data: { data } });
  }
  return created;
}
