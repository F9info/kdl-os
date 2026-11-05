import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'

export type AppIdentity = Record<string, string>

// Same default the admin shell and login screen hard-code today (replaced by T1.4b-d).
export const DEFAULT_APP_NAME = 'KDL Admin'

// Public application identity from GET /api/app-config (no login needed, so the login
// page can use it). The identity admin page invalidates ['app-config'] after a save.
export function useIdentity() {
  const { data, isLoading } = useQuery({
    queryKey: ['app-config'],
    queryFn: () => api.get('/app-config').then((r) => r.data.data.identity as AppIdentity),
    staleTime: 5 * 60 * 1000,
  })

  const identity = data ?? {}
  return {
    identity,
    // Empty or failed identity falls back to the default so the UI is never blank.
    appName: identity.app_name || DEFAULT_APP_NAME,
    isLoading,
  }
}
