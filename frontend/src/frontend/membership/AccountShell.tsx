'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import { useMe } from './api'
import { useMemberSession } from './useMemberSession'

const NAV = [
  ['/membership/account', 'My membership'],
  ['/membership/account/profile', 'Profile'],
  ['/membership/account/invoices', 'Invoices'],
  ['/membership/account/payments', 'Payments'],
  ['/membership/account/plan', 'Change plan'],
  ['/membership/account/library', 'Members-only content'],
  ['/membership/account/security', 'Security'],
] as const

export function AccountShell({ children }: { children: React.ReactNode }) {
  const session = useMemberSession()
  const me = useMe(session.ready)
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
  return (
    <div className="grid gap-8 md:grid-cols-[220px_1fr]">
      <nav aria-label="My account" className="space-y-1 text-sm">
        <p className="mb-3 font-semibold">{me.data?.member.full_name}</p>
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={pathname === href ? 'page' : undefined}
            className={`block rounded-md px-3 py-2 ${pathname === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            {label}
          </Link>
        ))}
        <button
          type="button"
          className="block w-full rounded-md px-3 py-2 text-left hover:bg-muted"
          onClick={() => {
            clearAuth()
            router.push('/login')
          }}
        >
          Log out
        </button>
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
