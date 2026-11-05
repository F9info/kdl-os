// Company Details still saves to the legacy brand-profile fields. These helpers copy what changed
// into Application Identity (the live source for the site's name and logo, T3.1), so editing
// Company Details updates the live site without re-running the Website stage.

type Values = Record<string, string>

const NAME = 'brand-profile-company-name'
const EMAIL = 'brand-profile-primary-email'
const PHONE = 'brand-profile-primary-phone'
const ADDRESS = ['brand-profile-address-1', 'brand-profile-address-2']

/**
 * `before`/`after` are field values by legacy slug. Only fields that changed are sent, so a value
 * edited on the Identity page is never overwritten by an untouched Company Details field.
 * `contactChanged`: phone, email or address changed. Those are still baked into page JSON, so the
 * caller keeps re-syncing the website for them.
 */
export function buildIdentityPatch(before: Values, after: Values) {
  const changed = (slug: string) => (before[slug] ?? '').trim() !== (after[slug] ?? '').trim()
  const patch: Values = {}
  if (changed(NAME)) patch.app_name = (after[NAME] ?? '').trim()
  if (changed(EMAIL)) patch.contact_email = (after[EMAIL] ?? '').trim()
  if (changed(PHONE)) patch.contact_phone = (after[PHONE] ?? '').trim()
  if (ADDRESS.some(changed)) {
    patch.contact_address = ADDRESS.map((s) => (after[s] ?? '').trim())
      .filter(Boolean)
      .join(', ')
  }
  const contactChanged =
    'contact_email' in patch || 'contact_phone' in patch || 'contact_address' in patch
  return { patch, contactChanged }
}
