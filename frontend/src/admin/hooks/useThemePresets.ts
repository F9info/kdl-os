import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { PRESETS, type Palette } from '@/app/admin/theme-engine/simple/palette'

export interface ThemePresetRow {
  key: string
  name: string
  light: Palette
  dark: Palette
  builtin: boolean
}

const key = ['theme-presets'] as const

// The looks come from the database (T10). The built-in list in palette.ts is only the fallback while the
// request is loading or if it fails, so the Simple view is never without a starting point.
export function useThemePresets() {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get('/theme-engine/presets').then((r) => r.data.data.presets as ThemePresetRow[]),
    staleTime: 60_000,
  })
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const create = useMutation({
    mutationFn: (input: { name: string; light: Palette; dark: Palette }) =>
      api.post('/theme-engine/presets', input).then((r) => r.data.data.preset as ThemePresetRow),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: (k: string) => api.delete(`/theme-engine/presets/${encodeURIComponent(k)}`),
    onSuccess: refresh,
  })
  const presets: ThemePresetRow[] =
    query.data ?? PRESETS.map((p) => ({ key: p.name.toLowerCase(), builtin: true, ...p }))
  return { presets, create, remove }
}
