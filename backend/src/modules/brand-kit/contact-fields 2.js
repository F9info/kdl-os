// Brand-kit contact details — Studio's Intake stage "Logo & Contact Details" form
// (KDL-558 roadmap row 1, prototype: templateEngine 2.html Overview screen).
//
// Deliberately NOT new BrandKit columns. Reuses the existing Application-Settings
// engine (Type + SettingField) the same way theme-engine scopes per-platform
// values (.agents/THEME_ENGINE_ARCH.md): one dedicated SettingField row per
// (project, field key), tagged owner_module: 'brand-kit' so these rows never
// appear in the generic /admin/settings/* screens or auto-generated sidebar nav.
// Values are stored in SettingValue (theme-engine's own value table), not
// SettingField.value directly, keeping schema (SettingField) and data
// (SettingValue) separate — same split theme-engine already uses.
import { prisma } from '../../config/database.js';

const OWNER_MODULE = 'brand-kit';

export const CONTACT_FIELD_CATALOGUE = [
  { key: 'company_name', label: 'Company name' },
  { key: 'primary_email', label: 'Primary email' },
  { key: 'secondary_email', label: 'Secondary email' },
  { key: 'primary_phone', label: 'Primary phone' },
  { key: 'secondary_phone', label: 'Secondary phone' },
  { key: 'address1', label: 'Address 1' },
  { key: 'address2', label: 'Address 2' },
];

const typeSlug = (projectId) => `brand-intake.${projectId}`;
const fieldSlug = (projectId, key) => `brand-intake.${projectId}.${key}`;

async function getOrCreateType(projectId) {
  const slug = typeSlug(projectId);
  const existing = await prisma.type.findUnique({ where: { slug } });
  if (existing) return existing;
  return prisma.type.create({
    data: { name: `Brand Intake — ${projectId}`, slug, owner_module: OWNER_MODULE },
  });
}

// Find-or-create every catalogue field for this project. Idempotent — safe to
// call on every read/write, only inserts rows the first time a project's
// intake form is touched.
async function getOrCreateFields(projectId) {
  const type = await getOrCreateType(projectId);
  const existing = await prisma.settingField.findMany({ where: { type_id: type.id } });
  const bySlug = new Map(existing.map((f) => [f.slug, f]));

  const fields = [];
  for (const [index, { key, label }] of CONTACT_FIELD_CATALOGUE.entries()) {
    const slug = fieldSlug(projectId, key);
    const field =
      bySlug.get(slug) ??
      (await prisma.settingField.create({
        data: {
          field_name: label,
          slug,
          input_type: 'textbox',
          type_id: type.id,
          owner_module: OWNER_MODULE,
          sort: index,
        },
      }));
    fields.push({ key, label, field });
  }
  return fields;
}

export async function getContactFields(projectId) {
  const fields = await getOrCreateFields(projectId);
  const values = await prisma.settingValue.findMany({
    where: { field_id: { in: fields.map((f) => f.field.id) } },
  });
  const valueByFieldId = new Map(values.map((v) => [v.field_id, v.value]));

  return fields.map(({ key, label, field }) => ({
    key,
    label,
    value: valueByFieldId.get(field.id) ?? '',
  }));
}

// `values` is a partial { [key]: string } map — unknown keys are ignored.
export async function saveContactFields(projectId, values, userId) {
  const fields = await getOrCreateFields(projectId);
  const fieldByKey = new Map(fields.map((f) => [f.key, f.field]));

  const writes = [];
  for (const [key, value] of Object.entries(values)) {
    const field = fieldByKey.get(key);
    if (!field) continue;
    writes.push(
      prisma.settingValue.upsert({
        where: { field_id: field.id },
        create: { field_id: field.id, platform: 'brand-kit', value: value ?? '', updated_by: userId },
        update: { value: value ?? '', updated_by: userId },
      })
    );
  }
  if (writes.length) await prisma.$transaction(writes);
  return getContactFields(projectId);
}

// Consumed by collateral's resolveBrandKit() to populate company.* for print
// layouts (visiting card / letterhead) — see backend/src/modules/collateral/render/layouts.js.
export async function getCompanyInfo(projectId) {
  const fields = await getContactFields(projectId);
  const byKey = Object.fromEntries(fields.map((f) => [f.key, f.value]));
  return {
    company_name: byKey.company_name || null,
    email: byKey.primary_email || null,
    phone: byKey.primary_phone || null,
    addressLines: [byKey.address1, byKey.address2].filter(Boolean),
  };
}
