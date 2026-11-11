'use client'

import { useState } from 'react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  commPath,
  errorMessage,
  useCommAction,
  useCommSettings,
} from '@/admin/hooks/useMembershipComm'
import { CommShell, Guarded } from '../../_components/CommShell'
import { Card, NativeSelect } from '../../_components/ui'

const schema = z.object({
  in_app: z.object({
    retention_days: z.coerce.number().int().min(1),
    show_unread_count: z.boolean(),
    toast_online: z.boolean(),
    per_page: z.coerce.number().int().min(5).max(100),
  }),
  whatsapp: z.object({
    provider: z.string().min(1),
    business_number: z.string().optional(),
    default_country_code: z.string().min(1),
    opt_in_required: z.boolean(),
  }),
  email: z.object({
    provider: z.string().min(1),
    sender_name: z.string().min(1, 'Sender name is required'),
    sender_email: z.string().email('Sender email is not valid'),
    reply_to: z.union([z.string().email('Reply-to is not valid'), z.literal('')]).optional(),
    layout: z.string().min(1),
  }),
  rules: z.object({ retry: z.boolean(), block_unresolved: z.boolean(), sms_fallback: z.boolean() }),
  member_preferences: z.boolean(),
})
type S = z.infer<typeof schema>
const DEFAULTS: S = {
  in_app: { retention_days: 90, show_unread_count: true, toast_online: true, per_page: 20 },
  whatsapp: {
    provider: 'meta',
    business_number: '',
    default_country_code: '+91',
    opt_in_required: true,
  },
  email: {
    provider: 'smtp',
    sender_name: '',
    sender_email: 'membership@example.com',
    reply_to: '',
    layout: 'branded',
  },
  rules: { retry: true, block_unresolved: true, sms_fallback: false },
  member_preferences: true,
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t py-2.5 text-sm first:border-0">
      <span>
        <b className="font-medium">{label}</b>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      {children}
    </div>
  )
}

function Form({ initial }: { initial: S }) {
  const [s, setS] = useState<S>(initial)
  const [err, setErr] = useState('')
  const action = useCommAction()
  const up = <K extends keyof S>(k: K, v: Partial<S[K]>) =>
    setS({ ...s, [k]: typeof s[k] === 'object' ? { ...(s[k] as object), ...v } : v })
  const sw = <K extends 'in_app' | 'whatsapp' | 'rules'>(k: K, f: keyof S[K] & string) => (
    <Switch
      aria-label={f}
      checked={Boolean(s[k][f as keyof S[K]])}
      onCheckedChange={(v) => up(k, { [f]: v } as Partial<S[K]>)}
    />
  )
  const save = () => {
    const r = schema.safeParse(s)
    if (!r.success) return setErr(r.error.issues[0]!.message)
    setErr('')
    action.mutate(
      { method: 'put', path: commPath('settings'), data: r.data },
      { onSuccess: () => toast({ title: 'Settings saved' }) }
    )
  }
  const test = (path: string, ok: string) =>
    action.mutate(
      { path: commPath(path) },
      {
        onSuccess: () => toast({ title: ok }),
        onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }),
      }
    )

  return (
    <CommShell
      error={action.error}
      action={
        <Button onClick={save} disabled={action.isPending}>
          Save settings
        </Button>
      }
    >
      {err && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {err}
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="In-app notifications">
          <Row label="Keep notifications for">
            <NativeSelect
              className="w-32"
              value={String(s.in_app.retention_days)}
              onChange={(e) => up('in_app', { retention_days: Number(e.target.value) })}
              options={[30, 90, 180, 365].map((d) => ({ value: String(d), label: `${d} days` }))}
            />
          </Row>
          <Row label="Show unread count on the bell">{sw('in_app', 'show_unread_count')}</Row>
          <Row label="Pop-up toast when online">{sw('in_app', 'toast_online')}</Row>
          <Row label="Items per page in the inbox">
            <NativeSelect
              className="w-24"
              value={String(s.in_app.per_page)}
              onChange={(e) => up('in_app', { per_page: Number(e.target.value) })}
              options={[10, 20, 50].map((d) => ({ value: String(d), label: String(d) }))}
            />
          </Row>
        </Card>
        <Card title="WhatsApp messages">
          <Row label="Provider" hint="From Integrations › Providers">
            <NativeSelect
              className="w-56"
              value={s.whatsapp.provider}
              onChange={(e) => up('whatsapp', { provider: e.target.value })}
              options={[
                { value: 'meta', label: 'Meta WhatsApp Cloud API' },
                { value: 'gupshup', label: 'Gupshup' },
              ]}
            />
          </Row>
          <Row label="Business number">
            <Input
              className="w-56"
              value={s.whatsapp.business_number ?? ''}
              onChange={(e) => up('whatsapp', { business_number: e.target.value })}
            />
          </Row>
          <Row label="Default country code">
            <Input
              className="w-24"
              value={s.whatsapp.default_country_code}
              onChange={(e) => up('whatsapp', { default_country_code: e.target.value })}
            />
          </Row>
          <Row label="Send only to members who opted in" hint="Required by WhatsApp">
            {sw('whatsapp', 'opt_in_required')}
          </Row>
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => test('settings/whatsapp/test', 'WhatsApp connection OK')}
            >
              Test connection
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => test('settings/whatsapp/sync', 'Templates synced')}
            >
              Sync templates
            </Button>
          </div>
        </Card>
        <Card title="Email messages">
          <Row label="Provider" hint="From Integrations › Providers">
            <NativeSelect
              className="w-56"
              value={s.email.provider}
              onChange={(e) => up('email', { provider: e.target.value })}
              options={[
                { value: 'smtp', label: 'SMTP' },
                { value: 'ses', label: 'Amazon SES' },
              ]}
            />
          </Row>
          <Row label="Sender name">
            <Input
              className="w-56"
              value={s.email.sender_name}
              onChange={(e) => up('email', { sender_name: e.target.value })}
            />
          </Row>
          <Row label="Sender email">
            <Input
              className="w-56"
              value={s.email.sender_email}
              onChange={(e) => up('email', { sender_email: e.target.value })}
            />
          </Row>
          <Row label="Reply-to">
            <Input
              className="w-56"
              value={s.email.reply_to ?? ''}
              onChange={(e) => up('email', { reply_to: e.target.value })}
            />
          </Row>
          <Row label="Email layout">
            <NativeSelect
              className="w-56"
              value={s.email.layout}
              onChange={(e) => up('email', { layout: e.target.value })}
              options={[
                { value: 'branded', label: 'KDL branded (logo + footer)' },
                { value: 'plain', label: 'Plain' },
              ]}
            />
          </Row>
          <div className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => test('settings/email/test', 'Test email sent')}
            >
              Send test email
            </Button>
          </div>
        </Card>
        <div>
          <Card title="Delivery rules">
            <Row label="Retry temporary failures" hint="3 attempts · 1 min, 5 min, 30 min">
              {sw('rules', 'retry')}
            </Row>
            <Row
              label="Block messages with unresolved variables"
              hint="The channel is stopped and logged as Failed"
            >
              {sw('rules', 'block_unresolved')}
            </Row>
            <Row
              label="One message per event per channel"
              hint="Event ID + channel is the idempotency key"
            >
              <span className="text-xs text-muted-foreground">Always on</span>
            </Row>
            <Row label="SMS as fallback when WhatsApp fails" hint="SMS is available but off">
              {sw('rules', 'sms_fallback')}
            </Row>
          </Card>
          <Card title="Member preferences">
            <Row label="Members can manage preferences">
              <Switch
                aria-label="Members can manage preferences"
                checked={s.member_preferences}
                onCheckedChange={(v) => setS({ ...s, member_preferences: v })}
              />
            </Row>
            <Row label="Always sent (cannot be turned off)">
              <span className="text-xs text-muted-foreground">
                Security · Payments &amp; invoices (Email + In-App)
              </span>
            </Row>
            <Row label="Marketing emails">
              <span className="text-xs text-muted-foreground">Unsubscribe link in every email</span>
            </Row>
            <Row label="Languages">
              <span className="text-xs text-muted-foreground">
                English (default), Telugu, Hindi
              </span>
            </Row>
          </Card>
        </div>
      </div>
    </CommShell>
  )
}

function SettingsContent() {
  const { data, isLoading } = useCommSettings()
  if (isLoading)
    return (
      <CommShell>
        <Skeleton className="h-40 w-full" />
      </CommShell>
    )
  const p = schema.safeParse({ ...DEFAULTS, ...data })
  return <Form initial={p.success ? p.data : DEFAULTS} />
}

export default function CommunicationSettingsPage() {
  return (
    <Guarded>
      <SettingsContent />
    </Guarded>
  )
}
