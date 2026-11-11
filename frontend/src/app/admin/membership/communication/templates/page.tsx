'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils'
import {
  CHANNELS,
  CHANNEL_LABEL,
  LANGS,
  useCommEvents,
  useCommTemplates,
} from '@/admin/hooks/useMembershipComm'
import { CommShell, Guarded } from '../../_components/CommShell'
import { NativeSelect } from '../../_components/ui'

const PAGE = 12

function TemplatesContent() {
  const tpl = useCommTemplates()
  const ev = useCommEvents()
  const [search, setSearch] = useState('')
  const [group, setGroup] = useState('')
  const [channel, setChannel] = useState('')
  const [lang, setLang] = useState('')
  const [page, setPage] = useState(1)

  const events = new Map((ev.data?.items ?? []).map((e) => [e.key, e]))
  // Templates are the source; events supply label + group when the template row omits them.
  const rows = (tpl.data?.items ?? [])
    .map((t) => ({
      ...t,
      label: t.label ?? events.get(t.event)?.label ?? t.event,
      group: t.group ?? events.get(t.event)?.group_label ?? events.get(t.event)?.group,
    }))
    .filter(
      (t) =>
        (!search || `${t.label} ${t.event}`.toLowerCase().includes(search.toLowerCase())) &&
        (!group || t.group === group) &&
        (!channel || t.channels?.includes(channel as never)) &&
        (!lang || t.languages?.includes(lang))
    )
  const groups = [
    ...new Set(
      (tpl.data?.items ?? [])
        .map((t) => t.group ?? events.get(t.event)?.group_label)
        .filter(Boolean)
    ),
  ] as string[]
  const pages = Math.max(1, Math.ceil(rows.length / PAGE))
  const shown = rows.slice((page - 1) * PAGE, page * PAGE)
  const langName = (k: string) => LANGS.find((l) => l.key === k)?.label ?? k

  return (
    <CommShell error={tpl.error}>
      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          className="min-w-56 flex-1"
          placeholder="Search event or template…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
        />
        <NativeSelect
          className="w-44"
          placeholder="All groups"
          value={group}
          onChange={(e) => {
            setGroup(e.target.value)
            setPage(1)
          }}
          options={groups.map((g) => ({ value: g, label: g }))}
        />
        <NativeSelect
          className="w-40"
          placeholder="All channels"
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value)
            setPage(1)
          }}
          options={CHANNELS.map((c) => ({ value: c, label: CHANNEL_LABEL[c] }))}
        />
        <NativeSelect
          className="w-40"
          placeholder="Language: all"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value)
            setPage(1)
          }}
          options={LANGS.map((l) => ({ value: l.key, label: l.label }))}
        />
      </div>
      {tpl.isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates match.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Event</th>
                <th className="px-3 py-2 font-medium">Channels</th>
                <th className="px-3 py-2 font-medium">Languages</th>
                <th className="px-3 py-2 font-medium">Last updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.event} className="border-b last:border-0">
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/membership/communication/templates/${t.event}/in-app`}>
                      <b className="font-semibold">{t.label}</b>
                      <div className="text-xs text-muted-foreground">
                        <code>{t.event}</code>
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex gap-1">
                      {CHANNELS.map((c) => (
                        <span
                          key={c}
                          className={`rounded-md px-2 py-0.5 text-xs ${t.channels?.includes(c) ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200' : 'bg-muted text-muted-foreground'}`}
                        >
                          {CHANNEL_LABEL[c]}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {(t.languages ?? []).map(langName).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">{t.updated_at ? formatDate(t.updated_at) : '—'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/membership/communication/templates/${t.event}/in-app`}>
                        Edit
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          Showing {rows.length ? (page - 1) * PAGE + 1 : 0}–{Math.min(page * PAGE, rows.length)} of{' '}
          {rows.length} · each event has an In-App, WhatsApp and Email template
        </span>
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
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </span>
      </div>
    </CommShell>
  )
}

export default function CommunicationTemplatesPage() {
  return (
    <Guarded>
      <TemplatesContent />
    </Guarded>
  )
}
