'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  type Channel,
  type CommEvent,
  CHANNELS,
  commPath,
  errorMessage,
  useCommAction,
  useCommEvents,
} from '@/admin/hooks/useMembershipComm'
import { ChannelMark, CommShell, Guarded } from '../_components/CommShell'
import { Kpi } from '../_components/ui'

const GROUP_FALLBACK = 'Events'
const LOCKABLE: Channel[] = ['IN_APP', 'EMAIL']

function EventsContent() {
  const { data, isLoading, error } = useCommEvents()
  const action = useCommAction()
  const events = data?.items ?? []
  const groups = useMemo(() => {
    const m = new Map<string, CommEvent[]>()
    for (const e of events) {
      const g = e.group_label ?? e.group ?? GROUP_FALLBACK
      m.set(g, [...(m.get(g) ?? []), e])
    }
    return [...m.entries()]
  }, [events])
  const on = (c: Channel) => events.filter((e) => e.channels?.[c]).length
  const mandatory = events.filter((e) => e.mandatory).length

  function toggle(e: CommEvent, channel: Channel, enabled: boolean) {
    action.mutate(
      { method: 'patch', path: commPath(`events/${e.key}`), data: { channel, enabled } },
      { onError: (err) => toast({ title: errorMessage(err), variant: 'destructive' }) }
    )
  }

  return (
    <CommShell
      error={error}
      action={
        <Button variant="outline" asChild>
          <Link href="/admin/membership/communication/templates">Send test</Link>
        </Button>
      }
    >
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No communication events yet. They are seeded when the Membership module is installed.
        </p>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Events"
              value={events.length}
              hint={`${groups.length} groups · seeded on install`}
            />
            <Kpi label="In-App" value={`${on('IN_APP')} on`} hint="core Notifications module" />
            <Kpi
              label="WhatsApp"
              value={`${on('WHATSAPP')} on`}
              hint="only to members who opted in"
            />
            <Kpi
              label="Email"
              value={`${on('EMAIL')} on`}
              hint={`${mandatory} mandatory · cannot be switched off by members`}
            />
          </div>
          <p className="mb-2 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
            One event → three channels, each sent as its own job. If WhatsApp fails, In-App and
            Email still go out. <Lock className="inline h-3 w-3" /> = mandatory (members cannot turn
            it off).
          </p>
          {groups.map(([group, rows]) => (
            <section key={group}>
              <div className="mb-2 mt-5 flex items-baseline justify-between">
                <h3 className="text-base font-semibold">{group}</h3>
                <span className="text-xs text-muted-foreground">{rows.length} events</span>
              </div>
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Event</th>
                      <th className="px-3 py-2 font-medium">Category</th>
                      {CHANNELS.map((c) => (
                        <th key={c} className="px-3 py-2 font-medium">
                          <ChannelMark channel={c} />
                        </th>
                      ))}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.key} className="border-b last:border-0">
                        <td className="px-3 py-2.5">
                          <Link href={`/admin/membership/communication/templates/${e.key}/in-app`}>
                            <b className="font-semibold">{e.label}</b>
                            <div className="text-xs text-muted-foreground">
                              <code>{e.key}</code>
                            </div>
                          </Link>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {e.category ?? '—'}
                          </span>
                        </td>
                        {CHANNELS.map((c) => (
                          <td key={c} className="px-3 py-2.5">
                            <span className="flex items-center gap-1.5">
                              <Switch
                                aria-label={`${e.label} ${c}`}
                                checked={Boolean(e.channels?.[c])}
                                disabled={action.isPending}
                                onCheckedChange={(v) => toggle(e, c, v)}
                              />
                              {e.mandatory && LOCKABLE.includes(c) && (
                                <Lock
                                  className="h-3 w-3 text-muted-foreground"
                                  aria-label="Mandatory"
                                />
                              )}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-2.5 text-right">
                          <Button size="sm" variant="outline" asChild>
                            <Link
                              href={`/admin/membership/communication/templates/${e.key}/in-app`}
                            >
                              Edit templates
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </CommShell>
  )
}

export default function CommunicationEventsPage() {
  return (
    <Guarded>
      <EventsContent />
    </Guarded>
  )
}
