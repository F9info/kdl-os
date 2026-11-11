'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  CreditCard,
  Crown,
  FileText,
  Layers,
  Lock,
  LogOut,
  Shield,
  User,
  type LucideIcon,
} from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import { useMe } from './api'
import { useUnreadCount } from './NotifApi'
import { useMemberSession } from './useMemberSession'

const NAV: [string, string, LucideIcon][] = [
  ['/membership/account', 'My membership', Crown],
  ['/membership/account/notifications', 'Notifications', Bell],
  ['/membership/account/card', 'Member card', CreditCard],
  ['/membership/account/invoices', 'Invoices', FileText],
  ['/membership/account/library', 'Members-only content', Lock],
  ['/membership/account/profile', 'Profile', User],
  ['/membership/account/plan', 'Change plan', Layers],
  ['/membership/account/security', 'Security', Shield],
]
const TITLES: Record<string, string> = { payments: 'Payments', cancel: 'Cancel membership' }

/** Account page title: the matching nav label (longest prefix wins), so one list drives both. */
const titleFor = (path: string) =>
  [...NAV].reverse().find(([h]) => path === h || path.startsWith(h + '/'))?.[1] ??
  TITLES[path.split('/')[3] ?? ''] ??
  'My membership'

/** Sidebar + title for the signed-in member. Rendered inside SiteShell (site header/footer). */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const session = useMemberSession()
  const me = useMe(session.ready)
  const unread = useUnreadCount(session.ready).data ?? 0
  const pathname = usePathname()
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  if (!session.ready || me.isLoading) return <LoadingSpinner />
  if (me.error)
    return (
      <div className="space-y-3">
        <ErrorAlert error={me.error} />
        <Link href="/membership" className="text-sm text-primary hover:underline">
          See membership plans
        </Link>
      </div>
    )
  const on = (h: string) => (h === '/membership/account' ? pathname === h : pathname.startsWith(h))
  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm'
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">My account</p>
        <h1 className="text-3xl font-bold">{titleFor(pathname)}</h1>
      </div>
      <div className="grid gap-6 md:grid-cols-[250px_1fr]">
        <nav
          aria-label="My account"
          className="h-fit space-y-1 rounded-xl border bg-card p-3 text-sm"
        >
          {NAV.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={on(href) ? 'page' : undefined}
              className={`${item} ${on(href) ? 'bg-primary font-medium text-primary-foreground' : 'hover:bg-muted'}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              {href.endsWith('/notifications') && unread > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-[11px] text-destructive-foreground">
                  {unread}
                </span>
              )}
            </Link>
          ))}
          <hr className="my-2" />
          <button
            type="button"
            className={`${item} text-left hover:bg-muted`}
            onClick={() => {
              clearAuth()
              router.push('/login')
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden /> Log out
          </button>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
