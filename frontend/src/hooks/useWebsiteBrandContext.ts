'use client'

import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import type { SettingField, Type } from '@/types/models.types'
import type { BrandContext } from '@/lib/website-layout-overrides'
import { useBrandKit, useTemplateEngineRuns } from './useTemplateEngine'

// Same "Logo & Contact Details" data source as IntakeStage.tsx, so the
// Layout picker and the Layout settings preview both show the real company
// name/phone/email instead of placeholder copy.
const BRAND_PROFILE_TYPE_SLUG = 'brand-profile'

// Everything the construction pack's Top Header/Header/Footer components
// need to render with a project's real brand data instead of their own
// generic placeholders. Shared by website/layout/page.tsx (the picker) and
// WebsiteLayoutPreview (the settings-card preview) so the two don't drift.
export function useWebsiteBrandContext(projectId: string): BrandContext {
  const { data: brandKit } = useBrandKit(projectId)
  const { data: runs } = useTemplateEngineRuns(projectId)
  const run = runs?.[0]

  const { data: brandProfile } = useQuery({
    queryKey: ['setting-fields-by-type', BRAND_PROFILE_TYPE_SLUG],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${BRAND_PROFILE_TYPE_SLUG}`)
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })
  const bySlug = Object.fromEntries(
    (brandProfile?.fields ?? []).map((f) => [f.slug, f.value ?? ''])
  )
  const companyName = bySlug['brand-profile-company-name'] || ''
  const email = bySlug['brand-profile-primary-email'] || ''
  const secondaryEmail = bySlug['brand-profile-secondary-email'] || ''
  const phone = bySlug['brand-profile-primary-phone'] || ''
  const secondaryPhone = bySlug['brand-profile-secondary-phone'] || ''
  const address = bySlug['brand-profile-address-1'] || ''
  const address2 = bySlug['brand-profile-address-2'] || ''

  const { data: logoMedia } = useQuery({
    queryKey: ['media', brandKit?.logo_media_id],
    queryFn: () =>
      api
        .get(`/media/${brandKit!.logo_media_id}`)
        .then((r) => r.data.data.media as { url: string | null }),
    enabled: !!brandKit?.logo_media_id,
  })

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
    logoUrl: logoMedia?.url ?? '',
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
