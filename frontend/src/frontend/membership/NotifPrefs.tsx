'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell, Lock, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { dateText } from './format'
import { type Channel, usePrefs, useSavePrefs, useWhatsapp } from './NotifApi'

const COLS: [Channel, string, typeof Bell][] = [
  ['IN_APP', 'In-App', Bell],
  ['WHATSAPP', 'WhatsApp', MessageCircle],
  ['EMAIL', 'Email', Mail],
]

export function NotifPrefs() {
  const q = usePrefs()
  const save = useSavePrefs()
  const wa = useWhatsapp()
  const [v, setV] = useState<Record<string, Partial<Record<Channel, boolean>>>>({})
  useEffect(() => {
    if (q.data)
      setV(
        Object.fromEntries(
          q.data.categories.map((c) => [
            c.key,
            Object.fromEntries(Object.entries(c.channels).map(([ch, s]) => [ch, !!s?.enabled])),
          ])
        )
      )
  }, [q.data])
  if (q.isLoading) return <LoadingSpinner />
  if (q.isError || !q.data)
    return (
      <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Communication preferences are not available yet.
      </p>
    )
  const { categories, whatsapp, email, language } = q.data
  return (
    <div className="space-y-5 rounded-xl border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Communication preferences</h2>
        <Button variant="outline" size="sm" asChild>
          <Link href="/membership/account/notifications">Back to notifications</Link>
        </Button>
      </div>
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        Choose how we reach you. <Lock className="h-3.5 w-3.5" aria-hidden /> Security and payment
        messages are always sent so your account and money stay safe.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="p-3 text-left font-medium">Messages about</th>
              {COLS.map(([k, label, Icon]) => (
                <th key={k} className="p-3 text-center font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Icon className="h-4 w-4" aria-hidden /> {label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.key} className="border-t">
                <td className="p-3">
                  <p className="font-semibold">{c.label}</p>
                  {c.description && (
                    <p className="text-xs text-muted-foreground">{c.description}</p>
                  )}
                </td>
                {COLS.map(([ch, label]) => {
                  const s = c.channels[ch]
                  return (
                    <td key={ch} className="p-3 text-center">
                      {s ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Switch
                            aria-label={`${c.label} via ${label}`}
                            checked={s.locked ? true : !!v[c.key]?.[ch]}
                            disabled={s.locked}
                            onCheckedChange={(on) =>
                              setV({ ...v, [c.key]: { ...v[c.key], [ch]: on } })
                            }
                          />
                          {s.locked && (
                            <Lock
                              className="h-3.5 w-3.5 text-muted-foreground"
                              aria-label="Always on"
                            />
                          )}
                        </span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div
          className={`space-y-2 rounded-lg border p-4 text-sm ${whatsapp?.opted_in ? 'border-green-300 bg-green-50 text-green-950 dark:bg-green-950/30 dark:text-green-100' : ''}`}
        >
          <p className="flex items-center gap-2 font-semibold">
            <MessageCircle className="h-4 w-4 text-green-600" aria-hidden />
            WhatsApp: {whatsapp?.opted_in ? 'opted in' : 'not opted in'}
          </p>
          <p className="text-muted-foreground">
            {whatsapp?.opted_in
              ? `${whatsapp.mobile ?? ''} · agreed on ${dateText(whatsapp.consented_at)}`
              : 'Get payment and renewal updates on WhatsApp. You can stop any time.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={wa.isPending}
            onClick={() => wa.mutate(!whatsapp?.opted_in)}
          >
            {whatsapp?.opted_in ? 'Stop WhatsApp messages' : 'Opt in to WhatsApp'}
          </Button>
          {wa.error ? <ErrorAlert error={wa.error} /> : null}
        </div>
        <div className="space-y-2 rounded-lg border p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold">
            <Mail className="h-4 w-4" aria-hidden /> Email: {email}
          </p>
          <p className="text-muted-foreground">
            Marketing emails have an unsubscribe link. Language: {language ?? 'English'}
          </p>
        </div>
      </div>
      {save.error ? <ErrorAlert error={save.error} /> : null}
      {save.isSuccess && (
        <p role="status" className="text-sm text-primary">
          Preferences saved.
        </p>
      )}
      <div className="flex justify-end">
        <Button disabled={save.isPending} onClick={() => save.mutate({ categories: v })}>
          Save preferences
        </Button>
      </div>
    </div>
  )
}
