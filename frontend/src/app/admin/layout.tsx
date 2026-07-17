'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { AdminShell } from '@/components/layout/AdminShell'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, accessToken, user, setAuth, clearAuth } = useAuthStore()
  const router = useRouter()
  const refreshing = useRef(false)

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.replace('/login')
      return
    }

    // Forced password change (KDL-283): the backend already 403s every API
    // call, so keep the user out of the admin shell entirely.
    if (user?.must_change_password) {
      router.replace('/change-password')
      return
    }

    if (isAuthenticated && !accessToken && !refreshing.current) {
      refreshing.current = true
      // Use raw fetch to bypass the axios interceptor — prevents interceptor loop
      fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((body: { data: { accessToken: string } }) => {
          setAuth(user!, body.data.accessToken)
        })
        .catch(() => {
          clearAuth()
          router.replace('/login')
        })
        .finally(() => {
          refreshing.current = false
        })
    }
  }, [isAuthenticated, isLoading, accessToken, user, setAuth, clearAuth, router])

  if (isLoading || (isAuthenticated && !accessToken)) {
    return <LoadingSpinner fullPage />
  }

  if (!isAuthenticated || user?.must_change_password) {
    return null
  }

  return <AdminShell>{children}</AdminShell>
}
