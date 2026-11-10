'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { toPaise, useAdminAction, usePlans, type Provider } from '@/admin/hooks/useMembership'
import { providerSchema, type ProviderFormData } from '../_schemas'
import { PROVIDER_PRESETS } from './providerPresets'
import { NativeSelect, enumOptions } from './ui'

const defaults = (kind: string, p?: Provider): ProviderFormData => ({
  provider: kind,
  label: p?.label ?? PROVIDER_PRESETS[kind]?.label ?? '',
  description: p?.description ?? '',
  mode: p?.mode ?? 'TEST',
  currency: p?.currency ?? 'INR',
  regions: p?.regions ?? 'INDIA',
  is_default: p?.is_default ?? false,
  min_amount: p?.min_amount != null ? p.min_amount / 100 : undefined,
  max_amount: p?.max_amount != null ? p.max_amount / 100 : undefined,
  member_types: p?.member_types ?? [],
  // Secrets are never prefilled: the API only tells us whether they are stored.
  key_id: '',
  key_secret: '',
  webhook_secret: '',
  options: p?.options ?? {},
  plan_ids: p?.plan_ids ?? [],
  manual_config: Object.fromEntries(
    Object.entries(p?.manual_config ?? {}).map(([k, v]) => [k, String(v ?? '')])
  ),
})

export function ProviderForm({
  kind,
  provider,
  onClose,
}: {
  kind: string | null // provider key being created, or the key of `provider` when editing
  provider?: Provider
  onClose: () => void
}) {
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const preset = kind ? PROVIDER_PRESETS[kind] : undefined
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<ProviderFormData>({
    resolver: zodResolver(providerSchema),
    values: kind ? defaults(kind, provider) : undefined,
  })
  const memberTypes = watch('member_types') ?? []
  const planIds = watch('plan_ids') ?? []
  const toggle = <T extends string>(list: T[], v: T, on: boolean) =>
    on ? [...list, v] : list.filter((x) => x !== v)

  function onSubmit(v: ProviderFormData) {
    const { key_id, key_secret, webhook_secret, min_amount, max_amount, ...rest } = v
    const credentials = Object.fromEntries(
      Object.entries({ key_id, key_secret }).filter(([, x]) => x)
    )
    const data = {
      ...rest,
      type: preset?.type ?? 'GATEWAY',
      min_amount: min_amount ? toPaise(min_amount) : null,
      max_amount: max_amount ? toPaise(max_amount) : null,
      // Only sent when typed; empty means "keep the stored value".
      ...(Object.keys(credentials).length ? { credentials } : {}),
      ...(webhook_secret ? { webhook_secret } : {}),
    }
    action.mutate(
      provider
        ? { method: 'patch', path: `payment-providers/${provider.id}`, data }
        : { path: 'payment-providers', data },
      {
        onSuccess: () => {
          toast({ title: provider ? 'Provider saved' : 'Provider added (draft)' })
          onClose()
        },
      }
    )
  }

  const saved = (flag?: boolean) => (flag ? 'Saved. Leave blank to keep it.' : 'Not set yet')

  return (
    <Modal
      open={kind !== null}
      onClose={onClose}
      size="lg"
      title={`${provider ? 'Edit' : 'Add'} ${preset?.label ?? 'provider'}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
            {provider ? 'Save changes' : 'Save draft'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
        <FormField label="Label on checkout" error={errors.label?.message} required>
          <Input {...register('label')} />
        </FormField>
        <FormField label="Short description">
          <Input {...register('description')} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_default')} /> Default provider (pre-selected)
        </label>

        {preset?.type === 'GATEWAY' && (
          <fieldset className="space-y-3 rounded-md border p-3">
            <legend className="px-1 text-sm font-medium">Credentials</legend>
            <FormField label="Mode">
              <NativeSelect options={enumOptions(['TEST', 'LIVE'])} {...register('mode')} />
            </FormField>
            <FormField label="Key ID" hint={saved(provider?.has_credentials)}>
              <Input type="password" autoComplete="new-password" {...register('key_id')} />
            </FormField>
            <FormField label="Key secret" hint={saved(provider?.has_credentials)}>
              <Input type="password" autoComplete="new-password" {...register('key_secret')} />
            </FormField>
            <FormField label="Webhook signing secret" hint={saved(provider?.has_webhook_secret)}>
              <Input type="password" autoComplete="new-password" {...register('webhook_secret')} />
            </FormField>
            <p className="text-xs text-muted-foreground">
              Stored encrypted. Never shown again after saving.
            </p>
          </fieldset>
        )}

        {(preset?.options ?? []).length > 0 && (
          <fieldset className="flex flex-wrap gap-4 text-sm">
            <legend className="mb-1 font-medium">Payment options</legend>
            {preset!.options!.map((o) => (
              <label key={o.key} className="flex items-center gap-2">
                <input type="checkbox" {...register(`options.${o.key}`)} /> {o.label}
              </label>
            ))}
          </fieldset>
        )}

        {preset?.type === 'MANUAL' &&
          preset.manual?.map((f) => (
            <FormField key={f.key} label={f.label}>
              {f.textarea ? (
                <Textarea rows={3} {...register(`manual_config.${f.key}`)} />
              ) : (
                <Input {...register(`manual_config.${f.key}`)} />
              )}
            </FormField>
          ))}

        <fieldset className="space-y-3 rounded-md border p-3">
          <legend className="px-1 text-sm font-medium">Who sees it</legend>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Plans (none = all)</span>
            {(plans?.items ?? []).map((p) => (
              <label key={p.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={planIds.includes(p.id)}
                  onChange={(e) => setValue('plan_ids', toggle(planIds, p.id, e.target.checked))}
                />
                {p.name}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">Member type (none = all)</span>
            {(['INDIVIDUAL', 'ORGANISATION'] as const).map((t) => (
              <label key={t} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={memberTypes.includes(t)}
                  onChange={(e) =>
                    setValue('member_types', toggle(memberTypes, t, e.target.checked))
                  }
                />
                {t === 'INDIVIDUAL' ? 'Individual' : 'Organisation'}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <FormField label="Country">
              <NativeSelect
                options={[
                  { value: 'INDIA', label: 'India' },
                  { value: 'OUTSIDE_INDIA', label: 'Outside India' },
                  { value: 'ALL', label: 'Everywhere' },
                ]}
                {...register('regions')}
              />
            </FormField>
            <FormField label="Currency">
              <Input maxLength={3} {...register('currency')} />
            </FormField>
            <FormField label="Min (INR)">
              <Input
                type="number"
                step="any"
                {...register('min_amount', {
                  setValueAs: (x) => (x === '' ? undefined : Number(x)),
                })}
              />
            </FormField>
            <FormField label="Max (INR)">
              <Input
                type="number"
                step="any"
                {...register('max_amount', {
                  setValueAs: (x) => (x === '' ? undefined : Number(x)),
                })}
              />
            </FormField>
          </div>
        </fieldset>
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}
