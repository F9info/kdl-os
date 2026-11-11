'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ago, useMarkRead, useNotifications, useUnreadCount } from './NotifApi'

export function NotifInbox() {
  const router = useRouter()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const list = useNotifications(page, unreadOnly)
  const count = useUnreadCount(true).data ?? 0
  const mark = useMarkRead()
  const items = list.data?.items ?? []
  const size = list.data?.pageSize ?? 6
  const total = list.data?.total ?? items.length
  const tab = (on: boolean, label: string) => (
    <button
      type="button"
      aria-pressed={unreadOnly === on}
      onClick={() => (setUnreadOnly(on), setPage(1))}
      className={`rounded-full px-3 py-1 text-sm ${unreadOnly === on ? 'bg-primary text-primary-foreground' : 'border hover:bg-muted'}`}
    >
      {label}
    </button>
  )
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b p-4">
        {tab(false, 'All')}
        {tab(true, `Unread · ${count}`)}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!count || mark.isPending}
            onClick={() => mark.mutate({ all: true })}
          >
            Mark all read
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/membership/account/notifications/preferences">Preferences</Link>
          </Button>
        </div>
      </div>
      {list.isLoading ? (
        <LoadingSpinner />
      ) : list.isError ? (
        <p className="p-6 text-sm text-muted-foreground">Notifications are not available yet.</p>
      ) : items.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          {unreadOnly ? 'You are all caught up.' : 'No notifications yet.'}
        </p>
      ) : (
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                className="flex w-full items-start gap-3 p-4 text-left hover:bg-muted/50"
                onClick={() => {
                  if (!n.read_at) mark.mutate({ ids: [n.id] })
                  if (n.link) router.push(n.link)
                }}
              >
                <span
                  aria-label={n.read_at ? 'Read' : 'Unread'}
                  className={`mt-2 h-2 w-2 shrink-0 rounded-full ${n.read_at ? 'bg-transparent' : 'bg-primary'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read_at ? '' : 'font-semibold'}`}>
                    {n.title}
                  </span>
                  {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{ago(n.created_at)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center justify-between border-t p-4 text-sm text-muted-foreground">
        <span>
          {items.length > 0 &&
            `Showing ${(page - 1) * size + 1}–${(page - 1) * size + items.length} of ${total} · kept for 90 days`}
        </span>
        <span className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page * size >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </span>
      </div>
    </div>
  )
}
