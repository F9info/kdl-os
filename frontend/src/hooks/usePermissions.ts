import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'

interface PermissionsResponse {
  permissions: string[]
  roles: string[]
  bypass: boolean
}

export function usePermissions() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const { data } = useQuery({
    queryKey: ['me-permissions'],
    queryFn: () =>
      api.get('/auth/me/permissions').then((r) => r.data.data as PermissionsResponse),
    staleTime: 5 * 60 * 1000,
    enabled: isAuthenticated,
  })

  const permissions = data?.permissions ?? []
  const roles = data?.roles ?? []
  const bypass = data?.bypass ?? false

  return {
    permissions,
    roles,
    bypass,
    can: (permission: string) => bypass || permissions.includes(permission),
    hasRole: (role: string) => roles.includes(role),
  }
}
