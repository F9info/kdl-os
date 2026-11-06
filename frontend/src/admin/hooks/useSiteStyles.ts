import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { refreshThemeEngineTokens } from '@/components/providers/ThemeEngineProvider'

// The one button style and the one form-field style of the whole website (Web app flow > Buttons and
// form fields). The server keeps the choice and adds its CSS to the theme, so saving here restyles the
// website, the page editor and the next static export.
export interface StyleOption {
  key: string
  label: string
  description: string
  /** CSS declarations of the resting style. */
  base: string
  /** Buttons: while pointed at. */
  hover?: string
  /** Form fields: while typing. */
  focus?: string
  /** Form fields: extra for text areas (e.g. they cannot be pill-shaped). */
  textarea?: string
}

export interface SiteStyles {
  button: string
  form: string
  options: { buttons: StyleOption[]; forms: StyleOption[] }
}

const key = ['site-styles'] as const

export function useSiteStyles() {
  return useQuery({
    queryKey: key,
    queryFn: () => api.get('/theme-engine/site-styles').then((r) => r.data.data as SiteStyles),
    staleTime: 60_000,
    retry: false, // a failure is shown at once, with the step's own error message
  })
}

export function useSaveSiteStyles() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { button?: string; form?: string }) =>
      api.put('/theme-engine/site-styles', input).then((r) => r.data.data as SiteStyles),
    onSuccess: (saved) => {
      qc.setQueryData(key, saved)
      refreshThemeEngineTokens() // the theme now carries the new CSS
    },
    onError: () =>
      toast({ title: 'Could not save the styles. Please try again.', variant: 'destructive' }),
  })
}
