'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useIdentity } from '@/hooks/useIdentity'
import { useAuthStore } from '@/stores/auth.store'
import { PageRender } from '@/frontend/rendering/PageRender'
import { getPageBySiteKey } from '@/frontend/pages/page-record'
import { isMemberOnly } from './roles'
import { chromeOf, MEMBER_LOGIN } from './siteChrome'
import { NotifBell } from './NotifBell'
import pubApi from '@/lib/axios'

/**
 * Member pages sit inside the real website chrome: the top bar, header and footer blocks of the
 * site's home page (same Puck blocks, menus, theme and identity as the public site), so editing
 * the site header changes it here too. With no published home page it falls back to a plain bar.
 */
export function SiteShell({ children }: { children: React.ReactNode }) {
  const { identity, appName, isLoading: identityLoading } = useIdentity()
  const { data: home, isLoading } = useQuery({
    queryKey: ['public-site-page', 'home'],
    queryFn: () => getPageBySiteKey('home'),
    retry: false,
  })
  const { isAuthenticated, user } = useAuthStore()
  const member = isAuthenticated && isMemberOnly(user)
  const chrome = useMemo(() => (home ? chromeOf(home.data, member) : null), [home, member])
  const loading = isLoading || identityLoading
  const render = (data: NonNullable<typeof chrome>['top']) =>
    home && data ? (
      <div className="[&>main]:!min-h-0">
        <PageRender page={{ ...home, data }} identity={identity} />
      </div>
    ) : null
  const useSite = !!chrome?.top

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {useSite ? (
        <div className="relative">
          {render(chrome.top)}
          {member && <MemberMenu />}
        </div>
      ) : loading ? (
        <div className="h-16" />
      ) : (
        <FallbackHeader name={appName} />
      )}
      <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>
      {useSite && render(chrome.bottom)}
      {!useSite && !loading && (
        <footer className="border-t py-4 text-center text-xs text-muted-foreground">
          Secure payments · GST invoice · Cancel anytime
        </footer>
      )}
    </div>
  )
}

function FallbackHeader({ name }: { name: string }) {
  const { isAuthenticated, user } = useAuthStore()
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-semibold">
          {name}
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
              <Link href={MEMBER_LOGIN} className="hover:underline">
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
  )
}

/** Logged-in member in the site header: bell, name and My account / Log out (sits over the header's right end). */
function MemberMenu() {
  const router = useRouter()
  const { user, clearAuth } = useAuthStore()
  const [open, setOpen] = useState(false)
  const logout = async () => {
    try {
      await pubApi.post('/auth/logout', {})
    } catch {
      // the local session is cleared either way
    }
    clearAuth()
    router.push('/membership')
  }
  const initials = (user?.name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return (
    <div className="pointer-events-none absolute inset-x-0 top-7 z-[60] hidden h-[60px] md:block">
      <div className="mx-auto flex h-full max-w-[1120px] items-center justify-end gap-3 px-4 pr-14">
        <div className="pointer-events-auto flex items-center gap-3">
          <NotifBell />
          <div className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {initials}
              </span>
              {user?.name?.split(' ')[0]}
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 top-11 z-50 w-44 rounded-lg border bg-card p-1 text-sm shadow-lg"
              >
                <Link
                  role="menuitem"
                  href="/membership/account"
                  className="block rounded px-3 py-2 hover:bg-muted"
                >
                  My account
                </Link>
                <button
                  role="menuitem"
                  type="button"
                  onClick={logout}
                  className="block w-full rounded px-3 py-2 text-left hover:bg-muted"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
