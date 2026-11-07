'use client'

import { useIdentity } from '../../hooks/useIdentity'
import type { BrandContext } from '@/admin/lib/website-layout-overrides'
import { useBrandKit, useTemplateEngineRuns } from './useTemplateEngine'

// Company details come from Application Identity (Settings > Identity), the single source, so the
// Layout picker and the Layout settings preview show the real company name/phone/email/logo
// instead of placeholder copy.

// Everything the construction pack's Top Header/Header/Footer components
// need to render with a project's real brand data instead of their own
// generic placeholders. Shared by website/layout/page.tsx (the picker) and
// WebsiteLayoutPreview (the settings-card preview) so the two don't drift.
export function useWebsiteBrandContext(projectId: string): BrandContext {
  const { data: brandKit } = useBrandKit(projectId)
  const { data: runs } = useTemplateEngineRuns(projectId)
  const run = runs?.[0]
  const { identity } = useIdentity()

  const companyName = identity.company_name || identity.app_name || ''
  const email = identity.contact_email || ''
  const secondaryEmail = identity.contact_email_secondary || ''
  const phone = identity.contact_phone || ''
  const secondaryPhone = identity.contact_phone_secondary || ''
  // Identity holds one address; a line break splits it into the two lines the headers show.
  const [address = '', ...rest] = (identity.contact_address || '').split(/\r?\n/)
  const address2 = rest.join(', ')
  const logoUrl = identity.company_logo_light || identity.logo_light || ''

  // Real assembled-page titles for the nav links preview, same outputRef
  // shape WebsiteStage.tsx reads (pageKeyToTitle) — empty until the
  // Website stage has actually produced pages at least once.
  const websiteStage = run?.stages.find((s) => s.stage === 'WEBSITE')
  const outputRef = websiteStage?.outputRef as
    { pageKeyToTitle?: Record<string, string> } | null | undefined
  const pageKeyToTitle = outputRef?.pageKeyToTitle ?? {}
  const links = Object.values(pageKeyToTitle)
    .map((title) => `${title}|#`)
    .join('\n')

  return {
    companyName,
    logoUrl,
    primaryColor: brandKit?.palette?.colors.primary?.hex ?? '',
    secondaryColor: brandKit?.palette?.colors.secondary?.hex ?? '',
    // "Tertiary"/"Quaternary" are PaletteStage's display-only labels for
    // the backend's real accent/neutral roles (see PaletteStage.tsx).
    tertiaryColor: brandKit?.palette?.colors.accent?.hex ?? '',
    quaternaryColor: brandKit?.palette?.colors.neutral?.hex ?? '',
    email,
    secondaryEmail,
    phone,
    secondaryPhone,
    address,
    address2,
    links,
  }
}
