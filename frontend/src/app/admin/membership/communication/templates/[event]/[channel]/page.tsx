'use client'

import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useRef, useState } from 'react'
import { z } from 'zod'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { cn, formatDate } from '@/lib/utils'
import {
  type Channel,
  type CommVariable,
  type TemplateBody,
  CHANNELS,
  LANGS,
  channelSlug,
  commPath,
  errorMessage,
  slugChannel,
  useCommAction,
  useCommEvents,
  useCommTemplate,
  useCommVariables,
} from '@/admin/hooks/useMembershipComm'
import { ChannelMark, Guarded } from '../../../../_components/CommShell'
import { Card } from '../../../../_components/ui'

const BASE = '/admin/membership/communication'
/** Used when GET /variables is empty (older backend); the list mirrors the mockup. */
const DEFAULT_VARS: CommVariable[] = [
  ['member_name', 'Suresh Varma'],
  ['member_email', 'suresh@example.com'],
  ['member_phone', '+91 98480 12345'],
  ['membership_name', 'Gold'],
  ['membership_plan', 'Gold · Yearly'],
  ['membership_id', 'MEM-2026-27-00413'],
  ['membership_status', 'Active'],
  ['start_date', '07 Nov 2026'],
  ['expiry_date', '06 Nov 2027'],
  ['renewal_date', '06 Nov 2027'],
  ['amount', '₹5,898.82'],
  ['currency', 'INR'],
  ['transaction_id', 'pay_Q8f2LxA91kZ'],
  ['payment_status', 'Paid'],
  ['payment_date', '07 Nov 2026'],
  ['invoice_url', 'https://example.com/invoice'],
  ['cancellation_date', ''],
  ['support_email', 'support@example.com'],
  ['company_name', 'Kalam Dream Labs'],
  ['company_logo', ''],
  ['website_url', 'https://example.com'],
].map(([key, sample]) => ({ key: key!, sample }))

/** Fields each channel edits; `required` is enforced by zod before PUT. */
const FIELDS: Record<
  Channel,
  Array<{ name: string; label: string; required?: boolean; area?: boolean; hint?: string }>
> = {
  IN_APP: [
    { name: 'title', label: 'Title', required: true },
    { name: 'message', label: 'Message', required: true, area: true },
    { name: 'link', label: 'Opens when clicked' },
    { name: 'icon', label: 'Icon' },
  ],
  EMAIL: [
    { name: 'subject', label: 'Subject', required: true },
    { name: 'preheader', label: 'Preheader' },
    { name: 'body', label: 'Body', required: true, area: true, hint: 'HTML · responsive layout' },
    { name: 'from', label: 'From' },
    { name: 'reply_to', label: 'Reply-to' },
  ],
  WHATSAPP: [
    { name: 'wa_template_name', label: 'Approved template name', required: true },
    { name: 'wa_category', label: 'Category · language' },
    { name: 'body', label: 'Message (as approved)', required: true, area: true },
    { name: 'wa_button_label', label: 'Button' },
    { name: 'wa_button_url', label: 'Button URL' },
  ],
  SMS: [{ name: 'body', label: 'Message', required: true, area: true }],
}

const fill = (s: string, vars: Record<string, string>) =>
  s.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k: string) => vars[k] ?? m)

function Editor({ event, channel, lang }: { event: string; channel: Channel; lang: string }) {
  const router = useRouter()
  const tpl = useCommTemplate(event, channel, lang)
  const vars = useCommVariables(event)
  const events = useCommEvents()
  const action = useCommAction()
  const meta = events.data?.items.find((e) => e.key === event)
  const list = vars.data?.length ? vars.data : DEFAULT_VARS
  const samples = Object.fromEntries(list.map((v) => [v.key, v.sample ?? '']))

  const [draft, setDraft] = useState<TemplateBody | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState(false)
  const [to, setTo] = useState('')
  const focus = useRef<string>(FIELDS[channel][0]!.name)
  const refs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  const base: TemplateBody = tpl.data ?? {}
  const val = (n: string) => String((draft ?? base)[n] ?? '')
  const enabled = (draft ?? base).enabled !== false
  const patch = (n: string, v: string | boolean) => setDraft({ ...(draft ?? base), [n]: v })

  function insert(key: string) {
    const name = focus.current
    const el = refs.current[name]
    const cur = val(name)
    const [s, e] = el
      ? [el.selectionStart ?? cur.length, el.selectionEnd ?? cur.length]
      : [cur.length, cur.length]
    patch(name, `${cur.slice(0, s)}{{${key}}}${cur.slice(e)}`)
  }

  function save() {
    const shape = Object.fromEntries(
      FIELDS[channel].map((f) => [
        f.name,
        f.required ? z.string().min(1, `${f.label} is required`) : z.string().optional(),
      ])
    )
    const r = z
      .object(shape)
      .safeParse(Object.fromEntries(FIELDS[channel].map((f) => [f.name, val(f.name)])))
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])))
      return
    }
    setErrors({})
    action.mutate(
      {
        method: 'put',
        path: commPath(`templates/${event}/${channel}/${lang}`),
        data: { ...base, ...draft, ...r.data, enabled },
      },
      {
        onSuccess: () => {
          toast({ title: 'Template saved' })
          setDraft(null)
        },
      }
    )
  }

  function sendTest() {
    const r = z.string().min(3, 'Enter an email address or mobile number').safeParse(to.trim())
    if (!r.success) return toast({ title: r.error.issues[0]!.message, variant: 'destructive' })
    action.mutate(
      { path: commPath(`templates/${event}/${channel}/${lang}/test`), data: { to: r.data } },
      {
        onSuccess: () => {
          toast({ title: `Test ${channel === 'EMAIL' ? 'email' : 'message'} sent to ${r.data}` })
          setTesting(false)
        },
        onError: (e) => toast({ title: errorMessage(e), variant: 'destructive' }),
      }
    )
  }

  const field = (f: (typeof FIELDS)[Channel][number]) => {
    const name = f.name
    const common = {
      value: val(name),
      onFocus: () => (focus.current = name),
      onChange: (e: { target: { value: string } }) => patch(name, e.target.value),
    }
    return (
      <FormField
        key={name}
        label={f.label}
        required={f.required}
        error={errors[name]}
        hint={f.hint}
      >
        {f.area ? (
          <Textarea
            rows={name === 'body' ? 9 : 4}
            ref={(el) => {
              refs.current[name] = el
            }}
            {...common}
          />
        ) : (
          <Input
            ref={(el) => {
              refs.current[name] = el
            }}
            {...common}
          />
        )}
      </FormField>
    )
  }

  const mapped = (s: string) => {
    // WhatsApp bodies use positional {{1}}; resolve through wa_fields (position -> variable key).
    const m = (base.wa_fields ?? {}) as Record<string, string>
    return fill(
      s.replace(/\{\{(\d+)\}\}/g, (x, n: string) => (m[n] ? (samples[m[n]] ?? x) : x)),
      samples
    )
  }
  const preview = (n: string) => mapped(val(n))

  const label = meta?.label ?? event
  return (
    <div>
      <PageHeader
        title={label}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Communication', href: BASE },
          { label: 'Templates', href: `${BASE}/templates` },
          { label: label },
        ]}
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push(`${BASE}/templates`)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={() => setTesting(true)}>
              Send test
            </Button>
            <Button onClick={save} disabled={action.isPending || !draft}>
              Save template
            </Button>
          </div>
        }
      />
      <div className="-mt-4 mb-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <code>{event}</code>
        {meta?.mandatory && (
          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
            Payment · mandatory
          </span>
        )}
        {typeof base.updated_at === 'string' && (
          <span>
            Last updated {formatDate(base.updated_at)}
            {typeof base.updated_by === 'string' ? ` by ${base.updated_by}` : ''}
          </span>
        )}
      </div>
      <nav role="tablist" className="mb-4 flex gap-1 border-b">
        {CHANNELS.map((c) => (
          <Link
            key={c}
            role="tab"
            aria-selected={c === channel}
            href={`${BASE}/templates/${event}/${channelSlug(c)}?lang=${lang}`}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              c === channel
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <ChannelMark channel={c} />
          </Link>
        ))}
      </nav>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 text-sm">
          <b>
            {channel === 'IN_APP' ? 'In-App' : channel === 'EMAIL' ? 'Email' : 'WhatsApp'} channel
          </b>
          <Switch
            aria-label="Channel enabled"
            checked={enabled}
            onCheckedChange={(v) => patch('enabled', v)}
          />
          <span className="text-xs text-muted-foreground">
            {meta?.mandatory && channel !== 'WHATSAPP'
              ? 'Members cannot switch this off'
              : channel === 'WHATSAPP'
                ? 'Sent only to members who opted in'
                : ''}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Language</span>
          <span className="inline-flex rounded-md border p-0.5" role="group">
            {LANGS.map((l) => (
              <Link
                key={l.key}
                href={`${BASE}/templates/${event}/${channelSlug(channel)}?lang=${l.key}`}
                className={cn(
                  'rounded px-3 py-1 text-xs',
                  l.key === lang ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}
              >
                {l.label}
              </Link>
            ))}
          </span>
        </div>
      </div>
      {tpl.error ? <ErrorAlert error={tpl.error} /> : null}
      {action.error ? <ErrorAlert error={action.error} /> : null}
      {tpl.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div>
            <Card
              title={
                CHANNELS.includes(channel)
                  ? channel === 'IN_APP'
                    ? 'In-App'
                    : channel === 'EMAIL'
                      ? 'Email'
                      : 'WhatsApp'
                  : channel
              }
            >
              <div className="space-y-4">
                {channel === 'WHATSAPP' && (
                  <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {typeof base.wa_status === 'string' ? `${base.wa_status} · ` : ''}Approved by
                    Meta, edits need re-approval.
                  </p>
                )}
                {FIELDS[channel].map(field)}
                {channel === 'IN_APP' && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(draft ?? base).toast === true}
                      onChange={(e) => patch('toast', e.target.checked)}
                    />
                    Also show as a pop-up toast when the member is online
                  </label>
                )}
              </div>
            </Card>
          </div>
          <div>
            <Card
              title={
                channel === 'IN_APP'
                  ? 'Preview · notification bell'
                  : channel === 'EMAIL'
                    ? 'Preview'
                    : 'Preview · WhatsApp'
              }
            >
              {channel === 'IN_APP' && (
                <div className="rounded-lg border p-3 text-sm">
                  <b>{preview('title') || '—'}</b>
                  <p className="text-xs text-muted-foreground">{preview('message')} · just now</p>
                </div>
              )}
              {channel === 'EMAIL' && (
                <div className="overflow-hidden rounded-lg border text-sm">
                  <div className="border-b-4 border-primary px-3.5 py-2.5 text-xs font-semibold">
                    {samples.company_name || 'Company'}
                  </div>
                  <div className="space-y-2 p-3.5">
                    <b className="text-base">{preview('subject') || '—'}</b>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed">{preview('body')}</p>
                  </div>
                </div>
              )}
              {channel !== 'IN_APP' && channel !== 'EMAIL' && (
                <div className="rounded-lg bg-[#e7f6e1] p-3 text-sm text-slate-900">
                  <p className="whitespace-pre-wrap">{preview('body') || '—'}</p>
                  {val('wa_button_label') && (
                    <p className="mt-2 rounded bg-white py-1 text-center text-xs text-blue-700">
                      {val('wa_button_label')}
                    </p>
                  )}
                </div>
              )}
            </Card>
            <Card title="Variables">
              <p className="mb-2 text-xs text-muted-foreground">
                Click to insert. A message is <b>never sent</b> with an unresolved variable — that
                channel is stopped and logged.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {list.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insert(v.key)}
                    className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
      <Modal
        open={testing}
        onClose={() => setTesting(false)}
        title="Send test"
        description={`Sends the saved ${label} template to one recipient with sample data.`}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTesting(false)}>
              Cancel
            </Button>
            <Button onClick={sendTest} disabled={action.isPending}>
              Send test
            </Button>
          </div>
        }
      >
        <FormField
          label={
            channel === 'EMAIL'
              ? 'To (email)'
              : channel === 'IN_APP'
                ? 'To (member email)'
                : 'To (mobile)'
          }
          required
        >
          <Input value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
      </Modal>
    </div>
  )
}

function EditorRoute() {
  const p = useParams<{ event: string; channel: string }>()
  const lang = useSearchParams().get('lang') ?? 'en'
  const channel = slugChannel(p.channel)
  return (
    <Guarded>
      {/* keyed so switching channel/language resets the draft from the freshly loaded template */}
      <Editor key={`${p.event}-${channel}-${lang}`} event={p.event} channel={channel} lang={lang} />
    </Guarded>
  )
}

export default function TemplateEditorPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <EditorRoute />
    </Suspense>
  )
}
