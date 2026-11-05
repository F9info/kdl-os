import { IDENTITY_FIELDS } from './schema.js';

// legacy SettingField slug -> identity field. `logo` is the admin logo field, which
// brand-kit already keeps in sync with the BrandKit logo (it holds a storage path).
export const LEGACY_SLUGS = {
  'brand-profile-company-name': 'app_name',
  'brand-profile-primary-email': 'contact_email',
  'brand-profile-primary-phone': 'contact_phone',
  'brand-profile-address-1': 'contact_address',
  'brand-profile-address-2': 'contact_address',
  logo: 'logo_light',
};
// Legacy data with no identity field yet — reported, left in place.
export const UNMAPPED_SLUGS = ['brand-profile-secondary-email', 'brand-profile-secondary-phone'];

const clean = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Pure: legacy = { slug: value }, current = identity object.
 * Returns { patch, report }. Never overwrites a non-empty identity value; invalid
 * values are skipped with a reason. app_title is seeded from the company name.
 */
export function planMigration(legacy, current) {
  const candidates = {};
  for (const [slug, field] of Object.entries(LEGACY_SLUGS)) {
    const v = clean(legacy[slug]);
    if (!v) continue;
    candidates[field] = field === 'contact_address' && candidates[field] ? `${candidates[field]}, ${v}` : v;
  }
  if (candidates.app_name) candidates.app_title = candidates.app_name;

  const patch = {};
  const report = { copied: [], skipped_existing: [], skipped_invalid: [], unmapped: [] };
  for (const [field, value] of Object.entries(candidates)) {
    if (clean(current[field])) report.skipped_existing.push(field);
    else if (!IDENTITY_FIELDS[field].safeParse(value).success) report.skipped_invalid.push(field);
    else {
      patch[field] = value;
      report.copied.push(field);
    }
  }
  report.unmapped = UNMAPPED_SLUGS.filter((s) => clean(legacy[s]));
  return { patch, report };
}

/** Reads legacy rows, plans, and (unless dry) writes via the identity service. */
export async function runMigration({ prisma, service, dry = false }) {
  const slugs = [...Object.keys(LEGACY_SLUGS), ...UNMAPPED_SLUGS];
  const rows = await prisma.settingField.findMany({ where: { slug: { in: slugs } }, select: { slug: true, value: true } });
  const legacy = Object.fromEntries(rows.map((r) => [r.slug, r.value]));
  const before = await service.getIdentity();
  const { patch, report } = planMigration(legacy, before);
  const after = !dry && Object.keys(patch).length ? await service.updateIdentity(patch) : { ...before, ...(dry ? patch : {}) };
  return { dry, before, after, patch, report };
}
