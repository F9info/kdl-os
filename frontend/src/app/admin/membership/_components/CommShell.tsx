'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { cn } from '@/lib/utils'
import { type Channel, CHANNEL_LABEL } from '@/admin/hooks/useMembershipComm'

export function Guarded({ children }: { children: ReactNode }) {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">{children}</PermissionGuard>
    </ModuleGuard>
  )
}

const BASE = '/admin/membership/communication'
const TABS = [
  { href: BASE, label: 'Events' },
  { href: `${BASE}/templates`, label: 'Templates' },
  { href: `${BASE}/reminders`, label: 'Reminders' },
  { href: `${BASE}/logs`, label: 'Logs' },
  { href: `${BASE}/settings`, label: 'Settings' },
]

/** Page chrome shared by the five Communication tabs (mockup adm-comm-*). */
export function CommShell({
  children,
  action,
  error,
}: {
  children: ReactNode
  action?: ReactNode
  error?: unknown
}) {
  const path = usePathname()
  const active = [...TABS].reverse().find((t) => path === t.href || path.startsWith(`${t.href}/`))
  return (
    <div>
      <PageHeader
        title="Communication"
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Communication' },
        ]}
        action={action}
      />
      <p className="-mt-4 mb-5 text-sm text-muted-foreground">
        In-App, WhatsApp and Email for every membership event
      </p>
      <nav role="tablist" className="mb-6 flex flex-wrap gap-1 border-b">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            role="tab"
            aria-selected={active?.href === t.href}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              active?.href === t.href
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {error ? <ErrorAlert error={error} /> : null}
      {children}
    </div>
  )
}

export function ChannelMark({ channel }: { channel: Channel }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {channel === 'WHATSAPP' && (
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-[9px] font-bold text-white">
          W
        </span>
      )}
      {CHANNEL_LABEL[channel]}
    </span>
  )
}

export const statusClass = (s: string) =>
  ['DELIVERED', 'READ', 'SENT'].includes(s)
    ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
    : s === 'FAILED'
      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
      : 'bg-muted text-muted-foreground'
