'use client'

import { useState, useEffect } from 'react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { useNotificationPreferences, useSavePreferences } from '@/hooks/useNotifications'
import type {
  NotificationChannel,
  CategoryPreferenceRow,
  NotificationPreference,
} from '@/types/notifications.types'

const CHANNELS: NotificationChannel[] = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP']
const CHANNEL_LABELS: Record<NotificationChannel, string> = {
  IN_APP: 'In-App',
  EMAIL: 'Email',
  SMS: 'SMS',
  WHATSAPP: 'WhatsApp',
}

type LocalMatrix = Record<string, Record<NotificationChannel, boolean>>

function buildLocalMatrix(rows: CategoryPreferenceRow[]): LocalMatrix {
  const m: LocalMatrix = {}
  for (const row of rows) {
    m[row.category_id] = {} as Record<NotificationChannel, boolean>
    for (const ch of CHANNELS) {
      const found = row.channels.find((c) => c.channel === ch)
      m[row.category_id]![ch] = found ? found.enabled : true
    }
  }
  return m
}

export default function NotificationPreferencesPage() {
  const { data, isLoading } = useNotificationPreferences()
  const save = useSavePreferences()

  const [matrix, setMatrix] = useState<LocalMatrix>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (!data?.preferences) return
    setMatrix(buildLocalMatrix(data.preferences))
    setDirty(false)
  }, [data])

  function toggle(categoryId: string, channel: NotificationChannel) {
    setMatrix((prev) => {
      const existing = (prev[categoryId] ?? {}) as Record<NotificationChannel, boolean>
      return {
        ...prev,
        [categoryId]: {
          ...existing,
          [channel]: !existing[channel],
        } as Record<NotificationChannel, boolean>,
      }
    })
    setDirty(true)
  }

  async function handleSave() {
    const preferences: NotificationPreference[] = []
    for (const [category_id, channels] of Object.entries(matrix)) {
      for (const [channel, enabled] of Object.entries(channels)) {
        preferences.push({ category_id, channel: channel as NotificationChannel, enabled })
      }
    }
    try {
      await save.mutateAsync(preferences)
      toast({ title: 'Preferences saved' })
      setDirty(false)
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' })
    }
  }

  const rows = data?.preferences ?? []

  return (
    <ModuleGuard slug="notifications">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          title="Notification Preferences"
          action={
            <Button onClick={handleSave} disabled={!dirty || save.isPending} size="sm">
              {save.isPending ? 'Saving…' : 'Save preferences'}
            </Button>
          }
        />

        {isLoading ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No notification categories configured.
          </div>
        ) : (
          <div className="mt-6 rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-3 font-medium">Category</th>
                  {CHANNELS.map((ch) => (
                    <th key={ch} className="text-center p-3 font-medium">
                      {CHANNEL_LABELS[ch]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.category_id} className={i < rows.length - 1 ? 'border-b' : ''}>
                    <td className="p-3">
                      <div className="font-medium">{row.category_name}</div>
                    </td>
                    {CHANNELS.map((ch) => (
                      <td key={ch} className="p-3 text-center">
                        <Switch
                          checked={matrix[row.category_id]?.[ch] ?? true}
                          onCheckedChange={() => toggle(row.category_id, ch)}
                          aria-label={`${row.category_name} ${CHANNEL_LABELS[ch]}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ModuleGuard>
  )
}
