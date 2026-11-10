'use client'

import Link from 'next/link'
import { useIdentity } from '@/hooks/useIdentity'
import { useAuthStore } from '@/stores/auth.store'
import { isMemberOnly } from './roles'

/** Header + footer for the public membership pages. Colours come from the site theme tokens. */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const { appName } = useIdentity()
  const { isAuthenticated, user } = useAuthStore()
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/" className="text-lg font-semibold">
            {appName}
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Membership">
            <Link href="/membership" className="hover:underline">
              Membership
            </Link>
            {isAuthenticated && isMemberOnly(user) ? (
              <Link href="/membership/account" className="font-medium text-primary hover:underline">
                My account
              </Link>
            ) : (
              <>
                <Link href="/login" className="hover:underline">
                  Log in
                </Link>
                <Link
                  href="/membership"
                  className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground"
                >
                  Become a member
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        Secure payments · GST invoice · Cancel anytime
      </footer>
    </div>
  )
}
