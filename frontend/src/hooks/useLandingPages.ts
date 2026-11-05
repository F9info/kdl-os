import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

export interface LandingPage {
  id: string
  slug: string
  title: string
  status: 'DRAFT' | 'PUBLISHED'
}

export interface LandingSite {
  id: string
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
