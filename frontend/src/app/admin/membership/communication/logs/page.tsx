'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import { formatDate } from '@/lib/utils'
import {
  CHANNELS,
  CHANNEL_LABEL,
  commPath,
  errorMessage,
  useCommAction,
  useCommLogs,
  useCommEvents,
} from '@/admin/hooks/useMembershipComm'
import { ChannelMark, CommShell, Guarded, statusClass } from '../../_components/CommShell'
import { Kpi, NativeSelect } from '../../_components/ui'

const STATUSES = ['QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED']
const LIMIT = 20
function LogsContent() {
  const [f, setF] = useState({ q: '', event: '', channel: '', status: '', from: '' })
  const [page, setPage] = useState(1)
  const logs = useCommLogs({ ...f, page, limit: LIMIT })
  const events = useCommEvents()
  const action = useCommAction()
  const set = (k: keyof typeof f, v: string) => {
    setF({ ...f, [k]: v })
    setPage(1)
  }
  const items = logs.data?.items ?? []
  const st = logs.data?.stats ?? {}
  const retry = (id: string) =>
    action.mutate(
      { path: commPath(`logs/${id}/retry`) },
      {
        onSuccess: () => toast({ title: 'Retry queued' }),
        onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }),
      }
    )
  const exportCsv = () => {
    const head = 'time,member,event,channel,recipient,status,provider_response'
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const body = items.map((l) =>
      [
        l.created_at,
        l.member_name,
        l.event,
        l.channel,
        l.recipient,
        l.status,
        l.provider_response ?? l.error,
      ]
        .map(esc)
        .join(',')
    )
    const url = URL.createObjectURL(new Blob([[head, ...body].join('\n')], { type: 'text/csv' }))
    Object.assign(document.createElement('a'), {
      href: url,
      download: 'communication-logs.csv',
    }).click()
    URL.revokeObjectURL(url)
  }

  return (
    <CommShell
      error={logs.error}
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv} disabled={!items.length}>
            Export CSV
          </Button>
          <Button
            onClick={() => items.filter((l) => l.status === 'FAILED').forEach((l) => retry(l.id))}
            disabled={!st.failed}
          >
            Retry all failed ({st.failed ?? 0})
          </Button>
        </div>
      }
    >
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Kpi
          label="Messages today"
          value={(st.total ?? logs.data?.total ?? 0).toLocaleString('en-IN')}
        />
        <Kpi
          label="Delivered / read"
          value={st.delivered_pct != null ? `${st.delivered_pct}%` : '—'}
        />
        <Kpi label="Failed" value={st.failed ?? 0} />
        <Kpi label="Pending / processing" value={st.pending ?? 0} />
        <Kpi label="Skipped (no opt-in)" value={st.skipped ?? 0} />
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="min-w-60 flex-1"
          placeholder="Member, recipient or message ID…"
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
        />
        <NativeSelect
          className="w-48"
          placeholder="Event: all"
          value={f.event}
          onChange={(e) => set('event', e.target.value)}
          options={(events.data?.items ?? []).map((e) => ({ value: e.key, label: e.label }))}
        />
        <NativeSelect
          className="w-40"
          placeholder="Channel: all"
          value={f.channel}
          onChange={(e) => set('channel', e.target.value)}
          options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
        />
        <NativeSelect
          className="w-40"
          placeholder="Status: all"
          value={f.status}
          onChange={(e) => set('status', e.target.value)}
          options={STATUSES.map((s) => ({
            value: s,
            label: s.charAt(0) + s.slice(1).toLowerCase(),
          }))}
        />
        <Input
          className="w-44"
          type="date"
          aria-label="From date"
          value={f.from}
          onChange={(e) => set('from', e.target.value)}
        />
      </div>
      {logs.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages match these filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                {[
                  'Time',
                  'Member',
                  'Event',
                  'Channel',
                  'Recipient',
                  'Status',
                  'Provider response',
                  '',
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-3 py-2.5">
                    {formatDate(l.created_at, 'dd MMM · HH:mm:ss')}
                  </td>
                  <td className="px-3 py-2.5">{l.member_name ?? '—'}</td>
                  <td className="px-3 py-2.5">{l.event_label ?? l.event}</td>
                  <td className="px-3 py-2.5">
                    <ChannelMark channel={l.channel} />
                  </td>
                  <td className="px-3 py-2.5">{l.recipient ?? '—'}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-md px-2 py-0.5 text-xs ${statusClass(l.status)}`}>
                      {l.status.charAt(0) + l.status.slice(1).toLowerCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">
                    {l.provider_response ?? l.error ?? '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {l.status === 'FAILED' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => retry(l.id)}
                        disabled={action.isPending}
                      >
                        Retry
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/admin/membership/communication/logs/${l.id}`}>View</Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex justify-between text-sm text-muted-foreground">
        <span>{logs.data?.total ?? 0} messages</span>
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page * LIMIT >= (logs.data?.total ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </span>
      </div>
    </CommShell>
  )
}

export default function CommunicationLogsPage() {
  return (
    <Guarded>
      <LogsContent />
    </Guarded>
  )
}
