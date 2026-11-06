import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Data } from '@puckeditor/core'
import api from '@/lib/axios'

export interface LandingPage {
  id: string
  slug: string
  title: string
  status: 'DRAFT' | 'PUBLISHED'
}

export interface LandingSite {
  id: string
  project_id: string
  slug: string
  name: string
  domain: string | null
  pages: LandingPage[]
}

export interface LandingTemplate {
  key: string
  name: string
  description: string
}

const sitesKey = ['landing-sites'] as const

export function useLandingSites() {
  return useQuery({
    queryKey: sitesKey,
    queryFn: () => api.get('/landing').then((r) => r.data.data.sites as LandingSite[]),
  })
}

export function useLandingTemplates() {
  return useQuery({
    queryKey: ['landing-templates'],
    queryFn: () =>
      api.get('/landing/templates').then((r) => r.data.data.templates as LandingTemplate[]),
    staleTime: Infinity,
  })
}

/** The page a template would create (nothing is stored): for the "View template" screen. */
export function useLandingTemplatePreview(key: string) {
  return useQuery({
    queryKey: ['landing-template-preview', key],
    queryFn: () =>
      api
        .get(`/landing/templates/${encodeURIComponent(key)}/preview`)
        .then((r) => r.data.data as { name: string; data: Data }),
    staleTime: Infinity,
    retry: false,
  })
}

export function useDeleteLandingSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (siteId: string) => api.delete(`/landing/${siteId}`).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: sitesKey }),
  })
}

export function useCreateLandingPage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; slug: string; template: string }) =>
      api.post('/landing', input).then((r) => r.data.data.site as LandingSite),
    onSuccess: () => qc.invalidateQueries({ queryKey: sitesKey }),
  })
}

/** Where the page editor opens a page. */
export const landingEditorHref = (pageId: string) => `/admin/template-engine/edit/${pageId}`

// ── Per-site identity overrides (T5.5) ───────────────────────────────────────

export const SITE_IDENTITY_KEYS = [
  'app_name',
  'app_title',
  'description',
  'logo_light',
  'logo_dark',
  'favicon',
  'contact_email',
  'contact_email_secondary',
  'contact_phone',
  'contact_phone_secondary',
  'contact_address',
  'copyright',
  'social_facebook',
  'social_x',
  'social_instagram',
  'social_linkedin',
  'social_youtube',
] as const
export type SiteIdentity = Partial<Record<(typeof SITE_IDENTITY_KEYS)[number], string>>

const identityKey = (siteId: string) => ['site-identity', siteId] as const
const identityUrl = (site: Pick<LandingSite, 'id' | 'project_id'>) =>
  `/projects/${site.project_id}/sites/${site.id}/identity`

/** `identity` holds what the form saves (storage paths); `resolved` the same pictures as URLs. */
export interface SiteIdentityData {
  identity: SiteIdentity
  resolved: Partial<Record<'logo_light' | 'logo_dark' | 'favicon', string>>
}

export function useSiteIdentity(site: Pick<LandingSite, 'id' | 'project_id'>) {
  return useQuery({
    queryKey: identityKey(site.id),
    queryFn: () =>
      api.get(identityUrl(site)).then((r) => {
        const data = r.data.data as Partial<SiteIdentityData>
        return { identity: data.identity ?? {}, resolved: data.resolved ?? {} } as SiteIdentityData
      }),
  })
}

/** Send every key: a non-empty value sets the override, '' removes it (inherit the project's). */
export function useSaveSiteIdentity(site: Pick<LandingSite, 'id' | 'project_id'>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: Record<(typeof SITE_IDENTITY_KEYS)[number], string>) =>
      api.put(identityUrl(site), input).then((r) => r.data.data.identity as SiteIdentity),
    // The saved paths need fresh picture URLs, so reload rather than patching the cache.
    onSuccess: () => qc.invalidateQueries({ queryKey: identityKey(site.id) }),
  })
}
