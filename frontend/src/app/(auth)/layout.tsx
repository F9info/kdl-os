'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth.store'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (user?.must_change_password) {
      // Forced password change: keep the user on /change-password, never the app.
      if (pathname !== '/change-password') router.push('/change-password')
      return
    }
    router.push('/admin/dashboard')
  }, [isAuthenticated, isLoading, user, pathname, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      {/* shadow-md uses the B1 elevation token from globals.css */}
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight">KDL Admin</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
