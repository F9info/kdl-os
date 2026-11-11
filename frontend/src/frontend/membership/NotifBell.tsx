'use client'

import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useAuthStore } from '@/stores/auth.store'
import { isMemberOnly } from './roles'
import { useUnreadCount } from './NotifApi'

/** Bell with unread count for the site header. Renders nothing unless a member is logged in. */
export function NotifBell() {
  const { isAuthenticated, accessToken, user } = useAuthStore()
  const on = isAuthenticated && !!accessToken && isMemberOnly(user)
  const { data = 0 } = useUnreadCount(on)
  if (!on) return null
  return (
    <Link
      href="/membership/account/notifications"
      aria-label={data ? `Notifications, ${data} unread` : 'Notifications'}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {data > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {data > 99 ? '99+' : data}
        </span>
      )}
    </Link>
  )
}
