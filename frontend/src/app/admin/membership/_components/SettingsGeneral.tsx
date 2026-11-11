'use client'

import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, useSettings, type Settings } from '@/admin/hooks/useMembership'
import { settingsGeneralSchema, type SettingsGeneralData } from '../_billing-schemas'
import { Card, NativeSelect } from './ui'

export const SETTINGS_GENERAL_FORM = 'membership-settings-general'

const STATES = [
  ['01', 'Jammu & Kashmir'],
  ['02', 'Himachal Pradesh'],
  ['03', 'Punjab'],
  ['04', 'Chandigarh'],
  ['05', 'Uttarakhand'],
  ['06', 'Haryana'],
  ['07', 'Delhi'],
  ['08', 'Rajasthan'],
  ['09', 'Uttar Pradesh'],
  ['10', 'Bihar'],
  ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'],
  ['13', 'Nagaland'],
  ['14', 'Manipur'],
  ['15', 'Mizoram'],
  ['16', 'Tripura'],
  ['17', 'Meghalaya'],
  ['18', 'Assam'],
  ['19', 'West Bengal'],
  ['20', 'Jharkhand'],
  ['21', 'Odisha'],
  ['22', 'Chhattisgarh'],
  ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'],
  ['27', 'Maharashtra'],
  ['29', 'Karnataka'],
  ['30', 'Goa'],
  ['32', 'Kerala'],
  ['33', 'Tamil Nadu'],
  ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'],
] as const

type Bag = Record<string, unknown>
const bag = (v: unknown): Bag => (v && typeof v === 'object' ? (v as Bag) : {})
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d)
const num = (v: unknown, d: number) => (typeof v === 'number' ? v : d)

function toForm(s: Settings): SettingsGeneralData {
  const g = s.general as unknown as Bag
  const rr = bag(g.renewal_rules)
  const pol = bag(g.policies)
  return {
    member_no_prefix: str(g.member_no_prefix, 'KDL-M'),
    invoice_prefix: str(g.invoice_prefix, 'MEM'),
    legal_name: str(pol.legal_name ?? g.legal_name),
    gstin: str(pol.gstin ?? g.gstin),
    state: str(pol.state ?? g.state),
    gst_rate_default: num(g.gst_rate_default, 18),
    sac: str(pol.sac ?? g.sac, '999599'),
    currency: str(pol.currency ?? g.currency, 'INR'),
    grace_days: num(g.grace_days, 7),
    renew_early_days: num(rr.renew_early_days, 60),
    after_grace: str(rr.after_grace, 'EXPIRE_LOCK') as SettingsGeneralData['after_grace'],
    terms_url: str(pol.terms_url),
    refund_policy_url: str(pol.refund_policy_url),
    cancel_policy: str(pol.cancel_policy, 'PERIOD_END') as SettingsGeneralData['cancel_policy'],
  }
}

/** Fields without a column of their own live in the two JSON bags (renewal_rules, policies); other keys are kept. */
function toPayload(v: SettingsGeneralData, s: Settings) {
  const g = s.general as unknown as Bag
  return {
    general: {
      member_no_prefix: v.member_no_prefix,
      invoice_prefix: v.invoice_prefix,
      gst_rate_default: v.gst_rate_default,
      grace_days: v.grace_days,
      renewal_rules: {
        ...bag(g.renewal_rules),
        renew_early_days: v.renew_early_days,
        after_grace: v.after_grace,
      },
      policies: {
        ...bag(g.policies),
        legal_name: v.legal_name ?? '',
        gstin: v.gstin ?? '',
        state: v.state ?? '',
        sac: v.sac ?? '',
        currency: v.currency,
        terms_url: v.terms_url ?? '',
        refund_policy_url: v.refund_policy_url ?? '',
        cancel_policy: v.cancel_policy,
      },
    },
  }
}

const opts = (xs: Array<[string | number, string]>) =>
  xs.map(([value, label]) => ({ value: String(value), label }))

export function SettingsGeneral({ settings }: { settings: Settings }) {
  const action = useAdminAction()
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SettingsGeneralData>({
    resolver: zodResolver(settingsGeneralSchema),
    defaultValues: toForm(settings),
  })
  const w = watch()
  const next = settings as unknown as { next_member_no?: string; next_invoice_no?: string }
  const num$ = { setValueAs: (x: string) => (x === '' ? 0 : Number(x)) }
  return (
    <form
      id={SETTINGS_GENERAL_FORM}
      className="grid items-start gap-6 xl:grid-cols-2"
      onSubmit={handleSubmit((v) =>
        action.mutate(
          { method: 'put', path: 'settings', data: toPayload(v, settings) },
          { onSuccess: () => toast({ title: 'Settings saved' }) }
        )
      )}
    >
      <Card title="Numbering">
        <div className="space-y-4">
          <FormField
            label="Member number prefix"
            error={errors.member_no_prefix?.message}
            hint={`${w.member_no_prefix}-{YYYY}-{#####}${next.next_member_no ? ` · Next: ${next.next_member_no}` : ''}`}
          >
            <Input {...register('member_no_prefix')} />
          </FormField>
          <FormField
            label="Invoice number prefix"
            error={errors.invoice_prefix?.message}
            hint={`${w.invoice_prefix}/{FY}/{#####} · Resets every April${next.next_invoice_no ? ` · next: ${next.next_invoice_no}` : ''}`}
          >
            <Input {...register('invoice_prefix')} />
          </FormField>
        </div>
      </Card>

      <Card title="Billing & GST">
        <div className="space-y-4">
          <FormField label="Legal name">
            <Input {...register('legal_name')} />
          </FormField>
          <FormField label="GSTIN" error={errors.gstin?.message}>
            <Input placeholder="37AAKCK1234M1Z9" {...register('gstin')} />
          </FormField>
          <FormField label="State">
            <NativeSelect
              placeholder="Choose a state…"
              options={STATES.map(([c, n]) => ({ value: n, label: `${n} (${c})` }))}
              {...register('state')}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="GST rate" error={errors.gst_rate_default?.message}>
              <NativeSelect
                options={opts([
                  [0, '0%'],
                  [5, '5%'],
                  [12, '12%'],
                  [18, '18%'],
                  [28, '28%'],
                ])}
                {...register('gst_rate_default', { valueAsNumber: true })}
              />
            </FormField>
            <FormField label="SAC" error={errors.sac?.message}>
              <Input {...register('sac')} />
            </FormField>
          </div>
          <FormField label="Currency">
            <NativeSelect
              options={opts([
                ['INR', 'INR — Indian Rupee'],
                ['USD', 'USD — US Dollar'],
                ['EUR', 'EUR — Euro'],
                ['GBP', 'GBP — Pound Sterling'],
              ])}
              {...register('currency')}
            />
          </FormField>
        </div>
      </Card>

      <Card title="Renewal rules">
        <div className="space-y-4">
          <FormField label="Grace period after expiry" hint="Member keeps access while they renew">
            <NativeSelect
              options={opts([
                [0, 'None'],
                [3, '3 days'],
                [7, '7 days'],
                [14, '14 days'],
                [30, '30 days'],
              ])}
              {...register('grace_days', { valueAsNumber: true })}
            />
          </FormField>
          <FormField label="Renew early" hint="New period starts after the current one">
            <NativeSelect
              options={opts([
                [0, 'Not allowed'],
                [30, 'Up to 30 days'],
                [60, 'Up to 60 days'],
                [90, 'Up to 90 days'],
              ])}
              {...register('renew_early_days', num$)}
            />
          </FormField>
          <FormField label="After grace period">
            <NativeSelect
              options={[
                { value: 'EXPIRE_LOCK', label: 'Expire & lock content' },
                { value: 'DOWNGRADE_FREE', label: 'Downgrade to Free' },
                { value: 'KEEP_ACCESS', label: 'Keep access (manual)' },
              ]}
              {...register('after_grace')}
            />
          </FormField>
          <p className="text-xs text-muted-foreground">
            Reminder messages are set in{' '}
            <Link
              className="text-primary underline"
              href="/admin/membership/communication/reminders"
            >
              Communication › Reminders
            </Link>
            .
          </p>
        </div>
      </Card>

      <Card title="Policies">
        <div className="space-y-4">
          <FormField label="Terms page" hint="Path of the page, e.g. /p/membership-terms">
            <Input {...register('terms_url')} />
          </FormField>
          <FormField label="Refund policy page" hint="e.g. /p/refund-policy">
            <Input {...register('refund_policy_url')} />
          </FormField>
          <Controller
            control={control}
            name="cancel_policy"
            render={({ field }) => (
              <FormField label="Members can cancel themselves">
                <NativeSelect
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'PERIOD_END', label: 'At the end of the paid period' },
                    { value: 'ANYTIME', label: 'Any time' },
                    { value: 'NEVER', label: 'Not allowed' },
                  ]}
                />
              </FormField>
            )}
          />
        </div>
      </Card>
      {action.error ? (
        <div className="xl:col-span-2">
          <ErrorAlert error={action.error} />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground xl:col-span-2">
        Turn the module on or off in KDL-OS › Modules · menu link in Frontend › Navigation · who can
        manage members in Roles &amp; permissions.
      </p>
    </form>
  )
}

export function GeneralTab() {
  const { data } = useSettings()
  return data ? <SettingsGeneral settings={data} /> : <Skeleton className="h-64 w-full" />
}
