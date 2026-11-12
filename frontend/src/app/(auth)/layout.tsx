'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { useAuthStore } from '@/stores/auth.store'
import { homeFor } from '@/frontend/membership/roles'
import { useIdentity } from '@/hooks/useIdentity'
import { AppImage } from '@/components/shared/AppImage'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, user } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()
  const { identity, appName } = useIdentity()

  // A fresh install has to go through the setup wizard before anyone can sign in. The server decides;
  // if it cannot be reached the login page shows as usual.
  const { data: install } = useQuery({
    queryKey: ['install', 'status'],
    queryFn: () => api.get('/install/status').then((r) => r.data.data as { installed: boolean }),
    retry: false,
    staleTime: 0,
  })
  useEffect(() => {
    if (install && !install.installed) router.replace('/install')
  }, [install, router])

  useEffect(() => {
    if (isLoading || !isAuthenticated) return
    if (user?.must_change_password) {
      // Forced password change: keep the user on /change-password, never the app.
      if (pathname !== '/change-password') router.push('/change-password')
      return
    }
    router.push(homeFor(user))
  }, [isAuthenticated, isLoading, user, pathname, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      {/* shadow-md uses the B1 elevation token from globals.css */}
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-md">
        <div className="mb-6 text-center">
          {identity.logo_light ? (
            <h1 className="flex justify-center">
              <AppImage
                size="logo"
                src={identity.logo_light}
                alt={appName}
                className={identity.logo_dark ? '[[data-theme=dark]_&]:hidden' : undefined}
              />
              {identity.logo_dark && (
                <AppImage
                  size="logo"
                  src={identity.logo_dark}
                  alt={appName}
                  className="hidden [[data-theme=dark]_&]:block"
                />
              )}
            </h1>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{appName}</h1>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
