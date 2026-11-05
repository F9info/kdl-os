import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import type { EnabledModule } from '@/types/models.types'

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
  const visible = enabledModules.filter((m) => !m.hidden_by_products)
  const nav = visible.flatMap((m) => m.nav)
  // Parts of a bundle (CMS) are listed under the bundle, not as separate top-level items.
  const nonCoreNav = visible.filter((m) => !m.core && !m.parent).flatMap((m) => m.nav)
  const bundles = visible
    .filter((b) => visible.some((m) => m.parent === b.slug))
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      items: visible.filter((m) => m.parent === b.slug).flatMap((m) => m.nav),
    }))

  return { enabledModules, isEnabled, nav, nonCoreNav, bundles, isLoading }
}
