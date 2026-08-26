'use client'

import { useState } from 'react'
import { Trash2, CheckCheck } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  useNotifications,
  useMarkRead,
  useMarkAllRead,
  useDeleteNotification,
} from '@/hooks/useNotifications'
import { useNotificationStream } from '@/hooks/useNotificationStream'
import { toast } from '@/hooks/use-toast'
import type { Notification } from '@/types/notifications.types'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const { data: notifications = [], isLoading } = useNotifications({ unreadOnly })
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()
  const deleteNotif = useDeleteNotification()

  useNotificationStream({
    onNew: (n: Notification) => {
      toast({ title: n.title, description: n.body })
    },
  })

  async function handleClick(n: Notification) {
    if (!n.read_at) await markRead.mutateAsync(n.id)
    if (n.data?.url) window.location.href = n.data.url as string
  }

  return (
    <ModuleGuard slug="notifications">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Notifications"
          action={
            <div className="flex gap-2">
              <Button
                variant={unreadOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUnreadOnly((v) => !v)}
              >
                {unreadOnly ? 'All' : 'Unread only'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            </div>
          }
        />

        <div className="mt-6 space-y-2">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3 rounded-lg border p-4 transition-colors',
                  !n.read_at ? 'bg-muted/40' : 'bg-background',
                  n.data?.url && 'cursor-pointer hover:bg-muted/60'
                )}
                onClick={() => n.data?.url && handleClick(n)}
              >
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm', !n.read_at && 'font-medium')}>{n.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!n.read_at && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        markRead.mutate(n.id)
                      }}
                    >
                      Mark read
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNotif.mutate(n.id)
                    }}
                    aria-label="Delete notification"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </ModuleGuard>
  )
}
