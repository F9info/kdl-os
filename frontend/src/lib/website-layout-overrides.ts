// Shared between the Layout picker (website/layout/page.tsx) and the
// Layout settings preview card (WebsiteStage.tsx) — both need the same
// "brand data → construction-pack component props" mapping and the same
// on/off + variant selection shape, so it lives here once instead of
// drifting into two slightly different copies.

export type Variant = '1' | '2' | '3' | '4'

export interface SectionState {
  enabled: boolean
  variant: Variant
}

export interface LayoutSelection {
  topHeader: SectionState
  header: SectionState
  footer: SectionState
}

export const DEFAULT_SELECTION: LayoutSelection = {
  topHeader: { enabled: false, variant: '1' },
  header: { enabled: true, variant: '1' },
  footer: { enabled: true, variant: '1' },
}

export interface BrandContext {
  companyName: string
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  tertiaryColor: string
  quaternaryColor: string
  email: string
  secondaryEmail: string
  phone: string
  secondaryPhone: string
  address: string
  address2: string
  // Pipe-delimited "Label|href" lines, one per line — the exact format
  // NavBar/Footer's own `links` field expects (see navLinksFor() in
  // backend/.../website-seed-content.js). Empty means "use the component's
  // own generic placeholder links" (no pages assembled yet).
  links: string
}

export function headerFooterOverrides(brand: BrandContext) {
  const overrides: Record<string, unknown> = {
    brand: brand.companyName || 'Your Brand',
    logoUrl: brand.logoUrl,
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    tertiaryColor: brand.tertiaryColor,
    quaternaryColor: brand.quaternaryColor,
  }
  if (brand.links) overrides.links = brand.links
  if (brand.companyName) {
    overrides.copyright = `© ${new Date().getFullYear()} ${brand.companyName}. All rights reserved.`
  }
  // ConstructionHeader's phoneNumber/email (Designs 2/3/4) were never
  // overridden here — Design 2's phone badge and Design 4's phone/email
  // badges were always showing the component's generic dummy defaults.
  if (brand.phone) overrides.phoneNumber = brand.phone
  if (brand.email) overrides.email = brand.email
  return overrides
}

// ConstructionFooter's own fields beyond what headerFooterOverrides already
// covers — same slug-first-else-dummy convention as layoutFooterProps() in
// backend/.../website-seed-content.js: Address 1 feeds "Showroom", Address 2
// feeds the separate "Regd. Office" block, only when each is actually set.
export function footerOverrides(brand: BrandContext) {
  const overrides: Record<string, unknown> = { ...headerFooterOverrides(brand) }
  if (brand.phone) overrides.contactPhone = brand.phone
  if (brand.secondaryPhone) overrides.contactPhone2 = brand.secondaryPhone
  if (brand.email) overrides.contactEmail = brand.email
  if (brand.secondaryEmail) overrides.contactEmail2 = brand.secondaryEmail
  if (brand.address) overrides.showroomAddress = brand.address
  if (brand.address2) overrides.regdOfficeAddress = brand.address2
  return overrides
}

// ConstructionTopBar is the only section with contact-info fields
// (address/phone/email) — NavBar/Footer don't render any. Same
// slug-first-else-dummy convention as constructionTopBarProps() in
// backend/.../website-seed-content.js: only overrides a field when the
// project's real Logo & Contact Details form actually has a value for it,
// otherwise leaves the component's own generic placeholder untouched.
export function topHeaderOverrides(brand: BrandContext) {
  const overrides: Record<string, unknown> = {
    primaryColor: brand.primaryColor,
    secondaryColor: brand.secondaryColor,
    tertiaryColor: brand.tertiaryColor,
    quaternaryColor: brand.quaternaryColor,
  }
  if (brand.address) overrides.d1Address = brand.address
  if (brand.phone) {
    overrides.d1Phone = brand.phone
    overrides.d3Phone = brand.phone
  }
  if (brand.email) {
    overrides.d1Email = brand.email
    overrides.d3Email = brand.email
  }
  return overrides
}

export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // best-effort — a private window or full storage shouldn't break the UI
  }
}

export function websiteLayoutStorageKey(projectId: string) {
  return `te-website-ui:${projectId}:layout`
}

// Shallow-merge over defaults rather than trusting a stored value's shape
// outright — an older iteration of this feature wrote a `{header, footer}`
// (no topHeader) object under the same key, and trusting it as-is crashes
// on `.topHeader.enabled`.
export function mergeLayoutSelection(stored: Partial<LayoutSelection>): LayoutSelection {
  return {
    topHeader: stored.topHeader ?? DEFAULT_SELECTION.topHeader,
    header: stored.header ?? DEFAULT_SELECTION.header,
    footer: stored.footer ?? DEFAULT_SELECTION.footer,
  }
}
