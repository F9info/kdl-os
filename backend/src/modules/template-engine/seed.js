import { prisma } from '../../config/database.js';
import { PLATFORMS, PLAT_TABS, slug } from './schema/index.js';

/**
 * Schema-driven seed for the Template Engine (Module 15, Phase A).
 *
 * Walks the built PLAT_TABS tree (TV px scaling is already applied by the
 * schema build loop, so defaults are written pre-scaled) and upserts:
 *   pane    → Type          slug = {platform}.{paneId}
 *   section → Category      slug = {platform}.{paneId}.{sectionSlug}[.{tag}]
 *   field   → SettingField  slug = {platform}.{paneId}.[{tag}.]{sectionSlug}.{fieldSlug}
 *
 * Idempotent: upsert-on-slug, safe to re-run, never duplicates. A slug
 * collision inside the schema is a build bug — fail loud, don't overwrite.
 *
 * Every Type/Category/SettingField row is stamped owner_module='template-engine'
 * so the generic Application-Settings UI (sidebar, /admin/settings/*) hides
 * this module's private data store — see core.prisma ownership contract.
 */

const OWNER_MODULE = 'template-engine';

const stringifyValue = (v) => {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v); // fonts / imglist / multiselect
  return String(v);
};

const buildOptions = (f) => {
  const o = {};
  if (f.o != null) o.choices = f.o;
  if (f.min != null) o.min = f.min;
  if (f.max != null) o.max = f.max;
  if (f.step != null) o.step = f.step;
  if (f.u != null && f.u !== '') o.unit = f.u;
  return Object.keys(o).length ? JSON.stringify(o) : null;
};

// Flatten the built schema into row payloads keyed by slug.
export function buildSeedRows() {
  const types = new Map();
  const categories = new Map();
  const fields = new Map();

  for (const p of PLATFORMS) {
    for (const t of PLAT_TABS[p.id]) {
      const typeSlug = `${p.id}.${t.id}`;
      if (types.has(typeSlug)) {
        throw new Error(`template-engine seed: duplicate type slug "${typeSlug}" — schema build bug, refusing to overwrite`);
      }
      types.set(typeSlug, { slug: typeSlug, name: t.label, is_active: true });

      for (const [sec, secFields, tag] of t.sections) {
        const catSlug = `${typeSlug}.${slug(sec)}${tag ? `.${tag}` : ''}`;
        if (categories.has(catSlug)) {
          throw new Error(`template-engine seed: duplicate category slug "${catSlug}" — schema build bug, refusing to overwrite`);
        }
        categories.set(catSlug, { slug: catSlug, name: sec, typeSlug, is_active: true });

        secFields.forEach((f, i) => {
          const fieldSlug = `${typeSlug}.${tag ? `${tag}.` : ''}${slug(sec)}.${slug(f.l)}`;
          if (fields.has(fieldSlug)) {
            throw new Error(`template-engine seed: duplicate field slug "${fieldSlug}" — schema build bug, refusing to overwrite`);
          }
          fields.set(fieldSlug, {
            slug: fieldSlug,
            field_name: f.l,
            input_type: f.t,
            value: stringifyValue(f.v),
            options: buildOptions(f),
            alt_text: f.h ?? null,
            typeSlug,
            catSlug,
            sort: i,
          });
        });
      }
    }
  }
  return { types, categories, fields };
}

export async function seedTemplateEngine(prismaClient = prisma) {
  // ARCH §Known Risks: seed must be atomic. Wrap in an interactive transaction
  // when given a base client; a client without $transaction is already a tx
  // (or a test double) — write through it directly. ~990 sequential upserts
  // need far more than Prisma's 5s default timeout.
  if (typeof prismaClient.$transaction === 'function') {
    return prismaClient.$transaction((tx) => seedInto(tx), { timeout: 180_000, maxWait: 10_000 });
  }
  return seedInto(prismaClient);
}

export default seedTemplateEngine;

async function seedInto(prismaClient) {
  const { types, categories, fields } = buildSeedRows();

  // Types (86) — upsert on slug.
  const typeIds = new Map();
  for (const t of types.values()) {
    const row = await prismaClient.type.upsert({
      where: { slug: t.slug },
      update: { name: t.name, is_active: t.is_active, owner_module: OWNER_MODULE },
      create: { ...t, owner_module: OWNER_MODULE },
    });
    typeIds.set(t.slug, row.id);
  }

  // Categories (~900) — upsert on slug.
  const catIds = new Map();
  for (const c of categories.values()) {
    const data = {
      name: c.name,
      type_id: typeIds.get(c.typeSlug),
      is_active: c.is_active,
      owner_module: OWNER_MODULE,
    };
    const row = await prismaClient.category.upsert({
      where: { slug: c.slug },
      update: data,
      create: { slug: c.slug, ...data },
    });
    catIds.set(c.slug, row.id);
  }

  // Fields (~3900) — createMany the missing, update the changed. One upsert
  // per row is too slow at this volume.
  const slugs = [...fields.keys()];
  const existing = new Map(
    (await prismaClient.settingField.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, field_name: true, input_type: true, value: true, options: true, alt_text: true, type_id: true, category_id: true, sort: true, owner_module: true },
    })).map((r) => [r.slug, r])
  );

  const toRow = (f) => ({
    slug: f.slug,
    field_name: f.field_name,
    input_type: f.input_type,
    value: f.value,
    options: f.options,
    alt_text: f.alt_text,
    type_id: typeIds.get(f.typeSlug),
    category_id: catIds.get(f.catSlug),
    sort: f.sort,
    owner_module: OWNER_MODULE,
  });

  const creates = [];
  let updated = 0;
  for (const f of fields.values()) {
    const row = toRow(f);
    const cur = existing.get(f.slug);
    if (!cur) {
      creates.push(row);
    } else if (
      cur.field_name !== row.field_name || cur.input_type !== row.input_type ||
      cur.value !== row.value || cur.options !== row.options ||
      cur.alt_text !== row.alt_text || cur.type_id !== row.type_id ||
      cur.category_id !== row.category_id || cur.sort !== row.sort ||
      cur.owner_module !== row.owner_module
    ) {
      await prismaClient.settingField.update({ where: { slug: f.slug }, data: row });
      updated += 1;
    }
  }

  const CHUNK = 500;
  for (let i = 0; i < creates.length; i += CHUNK) {
    await prismaClient.settingField.createMany({ data: creates.slice(i, i + CHUNK), skipDuplicates: true });
  }

  const summary = `template-engine seed: ${types.size} types, ${categories.size} categories, ${fields.size} fields (${creates.length} created, ${updated} updated)`;
  console.log(summary);
  return { types: types.size, categories: categories.size, fields: fields.size, created: creates.length, updated };
}
