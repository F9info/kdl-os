'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

/**
 * Member pages need a logged-in user with an access token. After a reload the store only has the
 * user, so restore the token from the refresh cookie (raw fetch: no axios interceptor loop).
 * `ready` is true once the API can be called as the member; otherwise this sends them to /login.
 */
export function useMemberSession() {
  const { isAuthenticated, isLoading, accessToken, user, setAuth, clearAuth } = useAuthStore()
  const router = useRouter()
  const refreshing = useRef(false)

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/login')
      return
    }
    if (user?.must_change_password) {
      router.replace('/change-password')
      return
    }
    if (!accessToken && !refreshing.current) {
      refreshing.current = true
      fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((b: { data: { accessToken: string } }) => setAuth(user!, b.data.accessToken))
        .catch(() => {
          clearAuth()
          router.replace('/login')
        })
        .finally(() => {
          refreshing.current = false
        })
    }
  }, [isLoading, isAuthenticated, accessToken, user, setAuth, clearAuth, router])

  return { ready: !isLoading && isAuthenticated && !!accessToken && !user?.must_change_password }
}
