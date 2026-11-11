'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  type Channel,
  CHANNELS,
  CHANNEL_LABEL,
  commPath,
  useCommAction,
  useCommReminders,
} from '@/admin/hooks/useMembershipComm'
import { CommShell, Guarded } from '../../_components/CommShell'
import { Card, NativeSelect } from '../../_components/ui'

const stepSchema = z.object({
  offset_days: z.number().int().min(-60).max(365),
  channels: z.record(z.string(), z.boolean()),
  template: z.string().min(1),
})
const schema = z.object({
  steps: z.array(stepSchema).min(1, 'Add at least one step'),
  rules: z.object({
    send_at: z.string().regex(/^\d{2}:\d{2}$/, 'Send time must be HH:MM'),
    timezone: z.string().min(1),
    skip_if_renewed: z.boolean(),
    skip_auto_renew: z.boolean(),
    quiet_hours: z.boolean(),
  }),
})
type Step = z.infer<typeof stepSchema>
type Data = z.infer<typeof schema>
type Upcoming = { date: string; label: string; count: number }

const DEFAULTS: Data = {
  steps: [30, 15, 7, 3, 1, 0, -7].map((d) => ({
    offset_days: d,
    channels: { IN_APP: true, WHATSAPP: true, EMAIL: true },
    template: 'renewal.reminder',
  })),
  rules: {
    send_at: '10:00',
    timezone: 'Asia/Kolkata',
    skip_if_renewed: true,
    skip_auto_renew: true,
    quiet_hours: true,
  },
}

const when = (d: number) =>
  d > 0 ? `${d} day${d > 1 ? 's' : ''} before` : d === 0 ? 'On expiry day' : `${-d} days after`

function Form({ initial, upcoming }: { initial: Data; upcoming: Upcoming[] }) {
  const [data, setData] = useState<Data>(initial)
  const [error, setError] = useState('')
  const action = useCommAction()
  const setStep = (i: number, s: Partial<Step>) =>
    setData({ ...data, steps: data.steps.map((x, j) => (j === i ? { ...x, ...s } : x)) })
  const setRule = (r: Partial<Data['rules']>) =>
    setData({ ...data, rules: { ...data.rules, ...r } })

  function save() {
    const r = schema.safeParse(data)
    if (!r.success) return setError(r.error.issues[0]!.message)
    setError('')
    action.mutate(
      { method: 'put', path: commPath('reminders'), data: r.data },
      { onSuccess: () => toast({ title: 'Reminder schedule saved' }) }
    )
  }
  const check = (
    label: string,
    hint: string,
    key: 'skip_if_renewed' | 'skip_auto_renew' | 'quiet_hours'
  ) => (
    <label className="flex items-start justify-between gap-3 border-t py-3 text-sm first:border-0">
      <span>
        <b className="font-medium">{label}</b>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={data.rules[key]} onCheckedChange={(v) => setRule({ [key]: v })} />
    </label>
  )

  return (
    <CommShell
      error={action.error}
      action={
        <Button onClick={save} disabled={action.isPending}>
          Save schedule
        </Button>
      }
    >
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card
          title="Renewal reminder schedule"
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setData({
                  ...data,
                  steps: [
                    ...data.steps,
                    {
                      offset_days: 1,
                      channels: { IN_APP: true, EMAIL: true },
                      template: 'renewal.reminder',
                    },
                  ],
                })
              }
            >
              <Plus className="h-3.5 w-3.5" /> Add step
            </Button>
          }
        >
          <p className="mb-3 text-sm text-muted-foreground">
            Each step sends the <b>Renewal reminder</b> templates with the days left filled in.
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">When</th>
                {CHANNELS.map((c) => (
                  <th key={c} className="py-2 font-medium">
                    {CHANNEL_LABEL[c]}
                  </th>
                ))}
                <th className="py-2 font-medium">Template</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.steps.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="py-2">
                    <Input
                      aria-label="Days before expiry"
                      type="number"
                      className="h-8 w-20"
                      value={s.offset_days}
                      onChange={(e) => setStep(i, { offset_days: Number(e.target.value) })}
                    />
                    <span className="text-xs text-muted-foreground">{when(s.offset_days)}</span>
                  </td>
                  {CHANNELS.map((c: Channel) => (
                    <td key={c}>
                      <Switch
                        aria-label={`${when(s.offset_days)} ${c}`}
                        checked={Boolean(s.channels[c])}
                        onCheckedChange={(v) => setStep(i, { channels: { ...s.channels, [c]: v } })}
                      />
                    </td>
                  ))}
                  <td>
                    <code className="text-xs">{s.template}</code>
                  </td>
                  <td className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setData({ ...data, steps: data.steps.filter((_, j) => j !== i) })
                      }
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <div>
          <Card title="Rules">
            <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
              <label>
                Send at
                <Input
                  type="time"
                  value={data.rules.send_at}
                  onChange={(e) => setRule({ send_at: e.target.value })}
                />
              </label>
              <label>
                Time zone
                <NativeSelect
                  value={data.rules.timezone}
                  onChange={(e) => setRule({ timezone: e.target.value })}
                  options={[
                    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                    { value: 'UTC', label: 'UTC' },
                  ]}
                />
              </label>
            </div>
            {check('Skip if already renewed', '', 'skip_if_renewed')}
            {check(
              'Skip members with auto-renew on',
              'They get "upcoming charge" instead',
              'skip_auto_renew'
            )}
            <div className="border-t py-3 text-sm">
              <b className="font-medium">Never send twice for the same step</b>
              <span className="block text-xs text-muted-foreground">
                Idempotent per member, period and step
              </span>
            </div>
            {check('Quiet hours 9 PM – 8 AM for WhatsApp', '', 'quiet_hours')}
          </Card>
          <Card title="Next 7 days">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              upcoming.map((u) => (
                <div
                  key={u.date + u.label}
                  className="flex justify-between border-t py-2 text-sm first:border-0"
                >
                  <span>
                    {u.date} · {u.label}
                  </span>
                  <b>{u.count} members</b>
                </div>
              ))
            )}
          </Card>
        </div>
      </div>
    </CommShell>
  )
}

function RemindersContent() {
  const { data, isLoading } = useCommReminders()
  if (isLoading)
    return (
      <CommShell>
        <Skeleton className="h-40 w-full" />
      </CommShell>
    )
  const parsed = schema.safeParse(data)
  return (
    <Form
      initial={parsed.success ? parsed.data : DEFAULTS}
      upcoming={(data as { upcoming?: Upcoming[] } | null)?.upcoming ?? []}
    />
  )
}

export default function CommunicationRemindersPage() {
  return (
    <Guarded>
      <RemindersContent />
    </Guarded>
  )
}
