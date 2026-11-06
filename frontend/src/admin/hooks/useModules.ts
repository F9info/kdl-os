import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import type { EnabledModule } from '@/types/models.types'
import { buildNavModel } from '@/admin/lib/nav-model'

export function useModules() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data, isLoading } = useQuery({
    queryKey: ['modules-enabled'],
    queryFn: () => api.get('/modules/enabled').then((r) => r.data.data.modules as EnabledModule[]),
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  })

  const enabledModules = data ?? []

  function isEnabled(slug: string): boolean {
    return enabledModules.some((m) => m.slug === slug)
  }

  // Menus show only what the chosen products need. isEnabled above still sees every enabled module.
  // The sidebar and command palette both render this one model (see admin/lib/nav-model.ts).
  const navModel = buildNavModel(enabledModules)

  return { enabledModules, isEnabled, navModel, isLoading }
}
