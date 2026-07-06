import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import type { EnabledModule } from '@/types/models.types'

export function useModules() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data, isLoading } = useQuery({
    queryKey: ['modules-enabled'],
    queryFn: () =>
      api.get('/modules/enabled').then((r) => r.data.data.modules as EnabledModule[]),
    staleTime: 60 * 1000,
    enabled: isAuthenticated,
  })

  const enabledModules = data ?? []

  function isEnabled(slug: string): boolean {
    return enabledModules.some((m) => m.slug === slug)
  }

  const nav = enabledModules.flatMap((m) => m.nav)
  const nonCoreNav = enabledModules.filter((m) => !m.core).flatMap((m) => m.nav)

  return { enabledModules, isEnabled, nav, nonCoreNav, isLoading }
}
