'use client'

import { useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useModules } from '@/hooks/useModules'
import { useUnreadCount, useNotifications, useMarkRead, useMarkAllRead } from '@/hooks/useNotifications'
import { useNotificationStream } from '@/hooks/useNotificationStream'
import { toast } from '@/hooks/use-toast'
import type { Notification } from '@/types/notifications.types'
import { cn } from '@/lib/utils'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const { isEnabled } = useModules()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const { data: unreadCount = 0 } = useUnreadCount()
  const { data: notifications = [] } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  useNotificationStream({
    onNew: (n: Notification) => {
      toast({ title: n.title, description: n.body })
    },
  })

  if (!isEnabled('notifications')) return null

  const latest = notifications.slice(0, 10)

  async function handleClick(n: Notification) {
    if (!n.read_at) await markRead.mutateAsync(n.id)
    setOpen(false)
    if (n.data?.url) router.push(n.data.url as string)
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications" data-testid="notification-bell">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span data-testid="notification-bell-badge" className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end" data-testid="notification-dropdown">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto py-0 px-1 text-xs font-normal"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {latest.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">No notifications</div>
        ) : (
          latest.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn(
                'flex flex-col items-start gap-0.5 cursor-pointer py-2.5',
                !n.read_at && 'bg-muted/50'
              )}
              onClick={() => handleClick(n)}
            >
              <div className="flex w-full items-start gap-2">
                {!n.read_at && (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm leading-snug', !n.read_at && 'font-medium')}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">
                  {timeAgo(n.created_at)}
                </span>
              </div>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-sm text-primary"
          onClick={() => {
            setOpen(false)
            router.push('/admin/notifications')
          }}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
