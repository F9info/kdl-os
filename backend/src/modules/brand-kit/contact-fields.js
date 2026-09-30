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

// Slugs of the *actual* "Logo & Contact Details" form (Studio's IntakeStage.tsx,
// KDL-558) — a global (not per-project) standalone SettingField Type seeded by
// brand-profile-fields.seed.js, edited through the generic
// GET/POST /setting-fields/by-type/brand-profile API. This module's own
// per-project `brand-intake.${projectId}` Type/rows above (getContactFields/
// saveContactFields) are dead: nothing in the frontend ever calls the
// /brand-kit/:projectId/contact routes they back, so getCompanyInfo() always
// found them empty and every consumer (template-engine's resolveWebsiteBrand,
// collateral's resolveBrandKit) silently fell back to "Your Brand" / no
// company info, regardless of what the user actually typed in the wizard.
const BRAND_PROFILE_FIELD_SLUGS = {
  company_name: 'brand-profile-company-name',
  primary_email: 'brand-profile-primary-email',
  primary_phone: 'brand-profile-primary-phone',
  secondary_email: 'brand-profile-secondary-email',
  secondary_phone: 'brand-profile-secondary-phone',
  address1: 'brand-profile-address-1',
  address2: 'brand-profile-address-2',
};

// Consumed by collateral's resolveBrandKit() to populate company.* for print
// layouts (visiting card / letterhead — see
// backend/src/modules/collateral/render/layouts.js) and by template-engine's
// resolveWebsiteBrand() to seed NavBar/Footer/Header defaults.
export async function getCompanyInfo(_projectId) {
  const fields = await prisma.settingField.findMany({
    where: { slug: { in: Object.values(BRAND_PROFILE_FIELD_SLUGS) } },
    select: { slug: true, value: true },
  });
  const bySlug = new Map(fields.map((f) => [f.slug, f.value]));
  const get = (key) => bySlug.get(BRAND_PROFILE_FIELD_SLUGS[key]) || null;

  return {
    company_name: get('company_name'),
    email: get('primary_email'),
    phone: get('primary_phone'),
    secondaryEmail: get('secondary_email'),
    secondaryPhone: get('secondary_phone'),
    addressLines: [get('address1'), get('address2')].filter(Boolean),
  };
}
