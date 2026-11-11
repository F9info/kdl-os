'use client'

import Link from 'next/link'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import {
  useAdminAction,
  useFieldGroups,
  usePlans,
  useSettings,
  type FieldGroup,
  type Settings,
} from '@/admin/hooks/useMembership'
import { settingsSignupSchema, type SettingsSignupData } from '../_billing-schemas'
import { Button } from '@/components/ui/button'
import { Segmented, ToggleRow } from './BillingBits'
import { Card, NativeSelect, humanize } from './ui'

export const SETTINGS_SIGNUP_FORM = 'membership-settings-signup'

const CORE_FIELDS = [
  ['Full name', true],
  ['Email', true],
  ['Mobile', true],
  ['Photo', false],
  ['Date of birth', false],
  ['Gender', false],
  ['Address', false],
  ['City', false],
  ['State', false],
  ['Pincode', false],
  ['Country', false],
  ['Preferred language', false],
  ['Consents', false],
] as const

type Signup = Settings['signup'] &
  Partial<Omit<SettingsSignupData, keyof Settings['signup']>> & {
    organisation_enabled?: boolean
  }

function toForm(s: Settings): SettingsSignupData {
  const g = s.signup as Signup
  return {
    primary_login: g.primary_login,
    allow_email_password: g.allow_email_password,
    require_approval_default: g.require_approval_default,
    verify_email_code: g.verify_email_code ?? true,
    ask_mobile_after_social: g.ask_mobile_after_social ?? true,
    auto_link_social: g.auto_link_social ?? false,
    organisation_enabled: g.member_types.includes('ORGANISATION'),
    max_contacts: g.max_contacts ?? 5,
    primary_contact: g.primary_contact ?? 'REQUIRED_BILLING',
    verify_documents: g.verify_documents ?? false,
  }
}

function SignupForm({ settings }: { settings: Settings }) {
  const action = useAdminAction()
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<SettingsSignupData>({
    resolver: zodResolver(settingsSignupSchema),
    defaultValues: toForm(settings),
  })
  const org = watch('organisation_enabled')
  const login = watch('primary_login')
  const toggle = (
    name: keyof SettingsSignupData,
    label: string,
    hint?: string,
    disabled?: boolean
  ) => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ToggleRow
          label={label}
          hint={hint}
          checked={Boolean(field.value)}
          onChange={field.onChange}
          disabled={disabled}
        />
      )}
    />
  )
  return (
    <form
      id={SETTINGS_SIGNUP_FORM}
      className="grid items-start gap-6 xl:grid-cols-2"
      onSubmit={handleSubmit(({ organisation_enabled, ...v }) =>
        action.mutate(
          {
            method: 'put',
            path: 'settings',
            data: {
              signup: {
                ...v,
                member_types: organisation_enabled
                  ? ['INDIVIDUAL', 'ORGANISATION']
                  : ['INDIVIDUAL'],
              },
            },
          },
          { onSuccess: () => toast({ title: 'Settings saved' }) }
        )
      )}
    >
      <Card title="Login & sign-up">
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium">Primary login method</p>
            <Controller
              control={control}
              name="primary_login"
              render={({ field }) => (
                <Segmented
                  label="Primary login method"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'MOBILE_OTP', label: 'Mobile OTP' },
                    { value: 'EMAIL', label: 'Email' },
                  ]}
                />
              )}
            />
          </div>
          {toggle(
            'allow_email_password',
            'Allow email & password as second option',
            login === 'EMAIL' ? 'Email + password is the primary method' : undefined
          )}
          {toggle(
            'verify_email_code',
            'Verify email by code',
            'Skipped for Google / Apple — already verified'
          )}
          {toggle('ask_mobile_after_social', 'Ask for mobile after social sign-up')}
          {toggle(
            'auto_link_social',
            'Auto-link social login to an existing email',
            'Off = member confirms once'
          )}
          {toggle('require_approval_default', 'New plans need approval by default')}
          <p className="text-xs text-muted-foreground">
            Social login providers and keys:{' '}
            <Link className="text-primary underline" href="/admin/membership/social-login">
              Integrations › Social login
            </Link>
          </p>
        </div>
      </Card>
      <Card title="Member types">
        <div className="space-y-3">
          <ToggleRow label="Individual" hint="Always on" checked disabled onChange={() => {}} />
          {toggle(
            'organisation_enabled',
            'Organisation',
            'A company, firm or institution with several people'
          )}
          {org && (
            <>
              <FormField
                label="Contacts per organisation (max)"
                error={errors.max_contacts?.message}
              >
                <Input
                  type="number"
                  min={1}
                  {...register('max_contacts', { valueAsNumber: true })}
                />
              </FormField>
              <FormField label="Primary contact">
                <NativeSelect
                  options={[
                    { value: 'REQUIRED_BILLING', label: 'Required · can manage billing' },
                    { value: 'REQUIRED', label: 'Required' },
                    { value: 'OPTIONAL', label: 'Optional' },
                  ]}
                  {...register('primary_contact')}
                />
              </FormField>
            </>
          )}
          {toggle(
            'verify_documents',
            'Documents must be verified before approval',
            'Applies to packs with file fields'
          )}
        </div>
      </Card>
      {action.error ? (
        <div className="xl:col-span-2">
          <ErrorAlert error={action.error} />
        </div>
      ) : null}
    </form>
  )
}

function PackRow({
  g,
  plans,
}: {
  g: FieldGroup
  plans: Array<{ id: string; name: string; field_groups?: Array<{ group_id: string }> }>
}) {
  const action = useAdminAction()
  const used = plans.filter((p) => p.field_groups?.some((x) => x.group_id === g.id))
  const fields = [...(g.fields ?? [])].sort((a, b) => a.sort - b.sort)
  return (
    <tr className="border-b last:border-0">
      <td className="py-3">
        <Link
          className="font-medium hover:underline"
          href={`/admin/membership/settings/fields/${g.id}`}
        >
          {g.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {fields
            .slice(0, 6)
            .map((f) => f.label)
            .join(', ')}
          {fields.length > 6 ? '…' : ''}
        </p>
      </td>
      <td>{fields.length}</td>
      <td>{g.applies_to === 'BOTH' ? 'Both' : humanize(g.applies_to)}</td>
      <td>{used.length ? used.map((p) => p.name).join(', ') : '—'}</td>
      <td>
        <Switch
          aria-label={`${g.name} on`}
          checked={g.is_active}
          disabled={action.isPending}
          onCheckedChange={(v) =>
            action.mutate({ method: 'patch', path: `field-groups/${g.id}`, data: { is_active: v } })
          }
        />
      </td>
    </tr>
  )
}

export function SignupTab({
  onPreset,
  onNewPack,
}: {
  onPreset: () => void
  onNewPack: () => void
}) {
  const { data: settings } = useSettings()
  const { data: groups, isLoading } = useFieldGroups()
  const { data: plans } = usePlans()
  const packs = groups?.items ?? []
  const presets = packs.filter((g) => (g as FieldGroup & { preset_key?: string | null }).preset_key)
  return (
    <div className="space-y-6">
      <Card
        title="Your sector set-up"
        action={
          <Button size="sm" variant="outline" onClick={onPreset}>
            Change
          </Button>
        }
      >
        <p className="text-sm text-muted-foreground">
          KDL-OS works for any sector. Switch on the field packs you need — or build your own.
        </p>
        <p className="mt-2 text-sm font-medium">
          {presets.length ? presets.map((p) => p.name).join(' · ') : 'No sector preset applied yet'}
        </p>
      </Card>
      <Card title="Core fields">
        <p className="-mt-3 mb-3 text-xs text-muted-foreground">
          Always on for every sector. Fixed columns — used by search, invoices and reports.
        </p>
        <div className="flex flex-wrap gap-2">
          {CORE_FIELDS.map(([name, req]) => (
            <span key={name} className="rounded-full border px-3 py-1 text-sm">
              {name}
              {req ? ' *' : ''}
            </span>
          ))}
        </div>
      </Card>
      <Card
        title="Field packs"
        action={
          <Button size="sm" onClick={onNewPack}>
            New pack
          </Button>
        }
      >
        <p className="-mt-3 mb-3 text-xs text-muted-foreground">
          Groups of fields asked at sign-up and shown on the member profile. Plans choose which
          packs they ask for.
        </p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : packs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No packs yet. Apply a preset or create your own.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2">Pack</th>
                  <th>Fields</th>
                  <th>Applies to</th>
                  <th>Used by plans</th>
                  <th>On</th>
                </tr>
              </thead>
              <tbody>
                {packs.map((g) => (
                  <PackRow key={g.id} g={g} plans={plans?.items ?? []} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {settings ? <SignupForm settings={settings} /> : <Skeleton className="h-48 w-full" />}
      <p className="text-xs text-muted-foreground">
        Custom fields are built on the same engine as Settings › Custom Fields — field types and
        categories are shared.
      </p>
    </div>
  )
}
