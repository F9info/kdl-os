'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Copy } from 'lucide-react'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { safeHref } from '@/frontend/lib/safe-href'
import { toPaise, useAdminAction, usePlans, type Provider } from '@/admin/hooks/useMembership'
import { providerFormSchema, type ProviderFormValues } from '../_billing-schemas'
import { DetailRow, Segmented, ToggleRow, fmtDateTime } from './BillingBits'
import { ProviderPublishModal, ProviderTestModal, type TestResult } from './ProviderModals'
import { PROVIDER_PRESETS } from './providerPresets'
import { Card, NativeSelect, humanize } from './ui'

export type ProviderRow = Provider & {
  logo_url?: string | null
  payment_count?: number
  usage?: {
    payments?: number
    waiting?: number
    avg_verify_hours?: number
    success_rate?: number
    last_30d?: number
  }
}

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']
const mc = (p?: Provider) => (p?.manual_config ?? {}) as Record<string, unknown>

function defaults(kind: string, p?: ProviderRow): ProviderFormValues {
  const preset = PROVIDER_PRESETS[kind]
  const types = p?.member_types ?? []
  return {
    provider: kind,
    label: p?.label ?? preset?.label ?? '',
    description: p?.description ?? '',
    logo_url: p?.logo_url ?? '',
    is_default: p?.is_default ?? false,
    mode: p?.mode ?? 'TEST',
    currency: p?.currency ?? (kind === 'STRIPE' || kind === 'PAYPAL' ? 'USD' : 'INR'),
    regions: p?.regions ?? (kind === 'STRIPE' || kind === 'PAYPAL' ? 'OUTSIDE_INDIA' : 'INDIA'),
    member_type: types.length === 1 ? types[0]! : 'ALL',
    min_amount: p?.min_amount != null ? p.min_amount / 100 : undefined,
    max_amount: p?.max_amount != null ? p.max_amount / 100 : undefined,
    key_id: '',
    key_secret: '',
    webhook_secret: '',
    options: Object.fromEntries(
      (preset?.options ?? []).map((o) => [o.key, p ? Boolean(p.options?.[o.key]) : true])
    ),
    plan_ids: p?.plan_ids ?? [],
    manual_config: { ...mc(p) },
  }
}

export function ProviderForm({
  kind,
  provider,
  onClose,
}: {
  kind: string
  provider?: Provider
  onClose?: () => void
}) {
  const router = useRouter()
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const preset = PROVIDER_PRESETS[kind]
  const p = provider as ProviderRow | undefined
  const [logoPicker, setLogoPicker] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [tested, setTested] = useState<TestResult | null>(null)
  const [busy, setBusy] = useState(false)
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProviderFormValues>({
    resolver: zodResolver(providerFormSchema),
    defaultValues: defaults(kind, p),
  })
  const gateway = preset?.type === 'GATEWAY'
  const values = watch()
  const draftish = !p || p.status === 'DRAFT' || p.status === 'HIDDEN'
  const symbol = values.currency === 'INR' ? 'INR' : values.currency
  const webhookUrl = `${typeof window === 'undefined' ? '' : window.location.origin}/api/webhooks/${kind.toLowerCase()}`
  const saved = (flag?: boolean) => (flag ? 'Saved. Leave blank to keep it.' : 'Not set yet')

  function payload(v: ProviderFormValues) {
    const { key_id, key_secret, webhook_secret, min_amount, max_amount, member_type, ...rest } = v
    const credentials = Object.fromEntries(
      Object.entries({ key_id, key_secret }).filter(([, x]) => x)
    )
    return {
      ...rest,
      logo_url: rest.logo_url || null,
      type: preset?.type ?? 'GATEWAY',
      member_types: member_type === 'ALL' ? [] : [member_type],
      min_amount: min_amount ? toPaise(min_amount) : null,
      max_amount: max_amount ? toPaise(max_amount) : null,
      // Only sent when typed; empty means "keep the stored value".
      ...(Object.keys(credentials).length ? { credentials } : {}),
      ...(webhook_secret ? { webhook_secret } : {}),
    }
  }

  /** Create or update, resolve with the saved provider so test / publish can chain on it. */
  function save(v: ProviderFormValues, then: (saved: ProviderRow) => void) {
    action.mutate(
      p
        ? { method: 'patch', path: `payment-providers/${p.id}`, data: payload(v) }
        : { path: 'payment-providers', data: payload(v) },
      { onSuccess: (d) => then(d as ProviderRow) }
    )
  }

  const done = (msg: string) => {
    toast({ title: msg })
    if (onClose) onClose()
    else router.push('/admin/membership/payment-methods')
  }
  const saveOnly = handleSubmit((v) =>
    save(v, () => done(p ? 'Provider saved' : 'Provider added (draft)'))
  )

  const testConnection = handleSubmit((v) =>
    save(v, (s) => {
      setBusy(true)
      action.mutate(
        { path: `payment-providers/${s.id}/test` },
        {
          onSuccess: (r) => setTested({ ...(r as object), label: v.label } as TestResult),
          onError: (e) =>
            setTested({ ok: false, message: (e as Error).message, label: v.label } as TestResult),
          onSettled: () => setBusy(false),
        }
      )
      if (!p) router.replace(`/admin/membership/payment-methods/${s.id}`)
    })
  )

  const publishNow = handleSubmit((v) =>
    save(v, (s) =>
      action.mutate(
        { path: `payment-providers/${s.id}/publish` },
        { onSuccess: () => done('Provider published') }
      )
    )
  )

  const planList = plans?.items ?? []
  const allPlans = values.plan_ids.length === 0
  const togglePlan = (id: string, on: boolean) => {
    const current = allPlans ? planList.map((x) => x.id) : values.plan_ids
    const next = on ? [...new Set([...current, id])] : current.filter((x) => x !== id)
    setValue('plan_ids', next.length === planList.length ? [] : next)
  }
  const setCfg = (k: string, v: unknown) =>
    setValue('manual_config', { ...values.manual_config, [k]: v })
  const cfg = values.manual_config

  return (
    <div>
      <PageHeader
        title={values.label || preset?.label || 'Payment method'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Payment methods', href: '/admin/membership/payment-methods' },
          { label: p ? humanize(p.status) : 'New' },
        ]}
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => (onClose ? onClose() : router.back())}>
              Cancel
            </Button>
            <Button asChild variant="outline">
              <Link href="/membership" target="_blank">
                Preview checkout
              </Link>
            </Button>
            {draftish ? (
              <>
                <Button variant="outline" onClick={saveOnly} disabled={action.isPending}>
                  Save draft
                </Button>
                <Button onClick={() => setPublishing(true)} disabled={action.isPending}>
                  Publish
                </Button>
              </>
            ) : (
              <Button onClick={saveOnly} disabled={action.isPending}>
                Save changes
              </Button>
            )}
          </div>
        }
      />
      <form
        className="grid items-start gap-6 xl:grid-cols-[1fr_400px]"
        onSubmit={saveOnly}
        autoComplete="off"
      >
        <div className="space-y-6">
          <Card title="Checkout display">
            <div className="grid gap-4 md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-2">
                {values.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeHref(values.logo_url)}
                    alt=""
                    className="h-14 w-14 rounded-lg object-contain"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex h-14 w-14 items-center justify-center rounded-lg text-lg font-bold text-white"
                    style={{ background: preset?.color ?? '#64748b' }}
                  >
                    {preset?.letter ?? '?'}
                  </span>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setLogoPicker(true)}
                >
                  Upload logo
                </Button>
              </div>
              <div className="space-y-4">
                <FormField label="Label on checkout" error={errors.label?.message} required>
                  <Input {...register('label')} />
                </FormField>
                <FormField label="Short description">
                  <Input {...register('description')} />
                </FormField>
                <Controller
                  control={control}
                  name="is_default"
                  render={({ field }) => (
                    <ToggleRow
                      label="Default provider"
                      hint="Pre-selected at checkout"
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              </div>
            </div>
          </Card>

          {gateway ? (
            <Card title="Credentials">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium">Mode</p>
                  <Controller
                    control={control}
                    name="mode"
                    render={({ field }) => (
                      <Segmented
                        label="Mode"
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'TEST', label: 'Test' },
                          { value: 'LIVE', label: 'Live' },
                        ]}
                      />
                    )}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label={preset?.keyLabels?.id ?? 'Key ID'}
                    hint={saved(p?.has_credentials)}
                  >
                    <Input type="password" autoComplete="new-password" {...register('key_id')} />
                  </FormField>
                  <FormField
                    label={preset?.keyLabels?.secret ?? 'Key secret'}
                    hint={saved(p?.has_credentials)}
                  >
                    <Input
                      type="password"
                      autoComplete="new-password"
                      {...register('key_secret')}
                    />
                  </FormField>
                </div>
                <FormField label="Webhook URL — copy into the provider dashboard">
                  <div className="flex gap-2">
                    <Input readOnly value={webhookUrl} aria-label="Webhook URL" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copy webhook URL"
                      onClick={() => {
                        void navigator.clipboard?.writeText(webhookUrl)
                        toast({ title: 'Webhook URL copied' })
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </FormField>
                <FormField label="Webhook signing secret" hint={saved(p?.has_webhook_secret)}>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...register('webhook_secret')}
                  />
                </FormField>
                <p className="text-xs text-muted-foreground">
                  Stored encrypted · never shown again after saving
                </p>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <Button type="button" variant="outline" disabled={busy} onClick={testConnection}>
                    Test connection
                  </Button>
                  <span className="text-muted-foreground">
                    Last test:{' '}
                    {p?.last_test_at
                      ? `${fmtDateTime(p.last_test_at)} · ${p.last_test_ok ? 'OK' : 'failed'}`
                      : 'not tested yet'}
                  </span>
                </div>
              </div>
            </Card>
          ) : (
            <Card title={`${preset?.label ?? 'Method'} details shown to the member`}>
              <div className="grid gap-4 sm:grid-cols-2">
                {preset?.manual?.map((f) => (
                  <div key={f.key} className={f.textarea ? 'sm:col-span-2' : undefined}>
                    <FormField label={f.label}>
                      {f.textarea ? (
                        <Textarea
                          rows={3}
                          value={String(cfg[f.key] ?? '')}
                          onChange={(e) => setCfg(f.key, e.target.value)}
                        />
                      ) : (
                        <Input
                          value={String(cfg[f.key] ?? '')}
                          onChange={(e) => setCfg(f.key, e.target.value)}
                        />
                      )}
                    </FormField>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {gateway && (preset?.options ?? []).length > 0 && (
            <Card title="Payment options">
              <p className="mb-2 text-sm text-muted-foreground">
                Switch on what this provider offers at checkout.
              </p>
              {preset!.options!.map((o) => (
                <Controller
                  key={o.key}
                  control={control}
                  name={`options.${o.key}`}
                  render={({ field }) => (
                    <ToggleRow
                      label={o.label}
                      hint={o.hint}
                      checked={Boolean(field.value)}
                      onChange={field.onChange}
                    />
                  )}
                />
              ))}
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card title="Who sees it">
            <div className="space-y-4 text-sm">
              <div>
                <p className="mb-1 font-medium">Plans</p>
                <div className="flex flex-wrap gap-2">
                  {planList.map((pl) => {
                    const on = allPlans || values.plan_ids.includes(pl.id)
                    return (
                      <label
                        key={pl.id}
                        className="flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) => togglePlan(pl.id, e.target.checked)}
                        />
                        {pl.name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="mb-1 font-medium">Member type</p>
                  <Controller
                    control={control}
                    name="member_type"
                    render={({ field }) => (
                      <Segmented
                        label="Member type"
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'ALL', label: 'Everyone' },
                          { value: 'INDIVIDUAL', label: 'Individual' },
                          { value: 'ORGANISATION', label: 'Organisation' },
                        ]}
                      />
                    )}
                  />
                </div>
                <div>
                  <p className="mb-1 font-medium">Country</p>
                  <Controller
                    control={control}
                    name="regions"
                    render={({ field }) => (
                      <Segmented
                        label="Country"
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'INDIA', label: 'India' },
                          { value: 'OUTSIDE_INDIA', label: 'Outside India' },
                          { value: 'ALL', label: 'Everywhere' },
                        ]}
                      />
                    )}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={`Minimum amount (${symbol})`}>
                  <Input
                    type="number"
                    step="any"
                    {...register('min_amount', {
                      setValueAs: (x) => (x === '' || x == null ? undefined : Number(x)),
                    })}
                  />
                </FormField>
                <FormField label={`Maximum amount (${symbol})`} error={errors.max_amount?.message}>
                  <Input
                    type="number"
                    step="any"
                    placeholder="No limit"
                    {...register('max_amount', {
                      setValueAs: (x) => (x === '' || x == null ? undefined : Number(x)),
                    })}
                  />
                </FormField>
              </div>
            </div>
          </Card>

          {gateway ? (
            <Card title="Currency & charges">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Currency">
                  <NativeSelect
                    options={CURRENCIES.map((c) => ({ value: c, label: c }))}
                    {...register('currency')}
                  />
                </FormField>
                <div>
                  <p className="mb-1 text-sm font-medium">Convenience fee</p>
                  <Segmented
                    label="Convenience fee"
                    value={String(cfg.fee_mode ?? 'NONE') as 'NONE' | 'FIXED' | 'PERCENT'}
                    onChange={(v) => setCfg('fee_mode', v)}
                    options={[
                      { value: 'NONE', label: 'None' },
                      { value: 'FIXED', label: 'Fixed' },
                      { value: 'PERCENT', label: '%' },
                    ]}
                  />
                  {(cfg.fee_mode === 'FIXED' || cfg.fee_mode === 'PERCENT') && (
                    <Input
                      className="mt-2"
                      aria-label="Fee"
                      type="number"
                      step="any"
                      value={String(cfg.fee_value ?? '')}
                      onChange={(e) =>
                        setCfg('fee_value', e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  )}
                </div>
              </div>
            </Card>
          ) : (
            <Card title="Verification & invoice">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-sm font-medium">Proof from member</p>
                  <Segmented
                    label="Proof from member"
                    value={String(cfg.proof_mode ?? 'REQUIRED') as 'REQUIRED' | 'OPTIONAL' | 'OFF'}
                    onChange={(v) => setCfg('proof_mode', v)}
                    options={[
                      { value: 'REQUIRED', label: 'Required' },
                      { value: 'OPTIONAL', label: 'Optional' },
                      { value: 'OFF', label: 'Off' },
                    ]}
                  />
                </div>
                <ToggleRow
                  label="Ask for UTR / reference number"
                  checked={cfg.ask_utr !== false}
                  onChange={(v) => setCfg('ask_utr', v)}
                />
                <FormField
                  label="Pay within (days)"
                  hint="Unpaid requests expire and the member is reminded halfway"
                >
                  <Input
                    type="number"
                    min={1}
                    value={String(cfg.pay_within_days ?? 7)}
                    onChange={(e) => setCfg('pay_within_days', Number(e.target.value))}
                  />
                </FormField>
                <ToggleRow
                  label="Activate membership on verification"
                  hint="Approval plans still go to the Approvals queue"
                  checked={cfg.activate_on_verify !== false}
                  onChange={(v) => setCfg('activate_on_verify', v)}
                />
                <ToggleRow
                  label="Issue GST invoice after verification"
                  checked={cfg.issue_invoice !== false}
                  onChange={(v) => setCfg('issue_invoice', v)}
                />
                <ToggleRow
                  label="Send proforma invoice with the bank details"
                  checked={Boolean(cfg.send_proforma)}
                  onChange={(v) => setCfg('send_proforma', v)}
                />
              </div>
            </Card>
          )}

          {p && (
            <Card title="Usage">
              <DetailRow label="Payments">{p.usage?.payments ?? p.payment_count ?? 0}</DetailRow>
              {p.usage?.waiting != null && (
                <DetailRow label="Waiting for verification">{p.usage.waiting}</DetailRow>
              )}
              {p.usage?.avg_verify_hours != null && (
                <DetailRow label="Avg. time to verify">{p.usage.avg_verify_hours} h</DetailRow>
              )}
              {p.usage?.success_rate != null && (
                <DetailRow label="Success rate">{p.usage.success_rate}%</DetailRow>
              )}
            </Card>
          )}

          {gateway && draftish && (
            <Card title="Before publishing">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <Check
                    className={`h-4 w-4 ${p?.has_credentials ? 'text-green-600' : 'text-muted-foreground'}`}
                  />{' '}
                  Keys saved
                </li>
                <li>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(cfg.webhook_added)}
                      onChange={(e) => setCfg('webhook_added', e.target.checked)}
                    />
                    Webhook added in the {preset?.label} dashboard
                  </label>
                </li>
                <li className="flex items-center gap-2">
                  <Check
                    className={`h-4 w-4 ${p?.last_test_ok ? 'text-green-600' : 'text-muted-foreground'}`}
                  />{' '}
                  Test connection {p?.last_test_ok ? 'passed' : 'not passed yet'}
                </li>
                <li className="text-muted-foreground">
                  {values.mode === 'LIVE'
                    ? 'Live mode on'
                    : 'Switch to Live mode when you are ready'}
                </li>
              </ul>
            </Card>
          )}
          {action.error && !publishing && !tested ? <ErrorAlert error={action.error} /> : null}
        </div>
      </form>
      <MediaPicker
        open={logoPicker}
        typeFilter="IMAGE"
        onClose={() => setLogoPicker(false)}
        onSelect={(m) => {
          setValue('logo_url', m[0]?.url ?? '')
          setLogoPicker(false)
        }}
      />
      <ProviderPublishModal
        open={publishing}
        onClose={() => setPublishing(false)}
        label={values.label}
        description={values.description}
        mode={values.mode}
        regions={values.regions}
        planNames={
          allPlans
            ? planList.map((x) => x.name)
            : planList.filter((x) => values.plan_ids.includes(x.id)).map((x) => x.name)
        }
        position={p ? p.sort + 1 : undefined}
        color={preset?.color}
        letter={preset?.letter}
        error={action.error}
        pending={action.isPending}
        onConfirm={() => {
          void publishNow()
        }}
      />
      <ProviderTestModal
        result={tested}
        onClose={() => setTested(null)}
        onPublish={() => {
          setTested(null)
          setPublishing(true)
        }}
        canPublish={draftish}
      />
    </div>
  )
}
