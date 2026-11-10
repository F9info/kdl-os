'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import { useAccess } from './api'

/**
 * Wrap members-only content: <MembersOnly path="/members/guide">...</MembersOnly>.
 * Asks GET /membership/me/access?path= and shows a join / upgrade prompt when not allowed.
 */
export function MembersOnly({ path, children }: { path: string; children: React.ReactNode }) {
  const authed = useAuthStore((s) => s.isAuthenticated && !!s.accessToken)
  const { data, isLoading, isError } = useAccess(path)
  if (isLoading && authed) return <LoadingSpinner />
  if (authed && data?.allowed) return <>{children}</>
  const upgrade = authed && !isError
  return (
    <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-8 text-center">
      <Lock className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
      <h2 className="text-xl font-semibold">Members only</h2>
      <p className="text-sm text-muted-foreground">
        {upgrade
          ? `This content needs the ${data?.plan_required ?? 'a higher'} plan.`
          : 'Log in as a member to see this content.'}
      </p>
      <Link
        href={upgrade ? '/membership/account/plan' : '/login'}
        className="inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
      >
        {upgrade ? 'Upgrade plan' : 'Log in'}
      </Link>
      <div>
        <Link href="/membership" className="text-sm text-primary hover:underline">
          See plans
        </Link>
      </div>
    </div>
  )
}
