'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, usePlans, type Plan } from '@/admin/hooks/useMembership'
import { accessRuleSchema, type AccessRuleData } from '../_billing-schemas'
import { TARGET_LABEL, groupRules, parseKey, planUpdates, type PlanRule } from './AccessRulesParts'
import { Segmented, ToggleRow } from './BillingBits'
import { Card, NativeSelect } from './ui'

const TARGETS = ['PAGE', 'SECTION', 'MEDIA', 'URL_PATTERN'] as const
const PLACEHOLDER = {
  PAGE: '/p/resources/annual-report-2026',
  SECTION: 'section id',
  MEDIA: 'media collection id',
  URL_PATTERN: '/p/resources/*',
} as const

export function AccessRuleEditor({ ruleKey }: { ruleKey: string }) {
  const router = useRouter()
  const action = useAdminAction()
  const { data } = usePlans()
  const plans: Plan[] = data?.items ?? []
  const isNew = ruleKey === 'new'
  const original = isNew ? null : parseKey(ruleKey)
  const existing = original
    ? groupRules(plans).find((r) => r.target === original.target && r.value === original.value)
    : undefined
  const [confirmDelete, setConfirmDelete] = useState(false)

  const allIds = plans.map((p) => p.id)
  const existingIds = existing?.plans.map((p) => p.id) ?? []
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AccessRuleData>({
    resolver: zodResolver(accessRuleSchema),
    // `values` so the form fills once the plans have loaded
    values: {
      target: original?.target ?? 'PAGE',
      value: original?.value ?? '',
      label: existing?.label ?? '',
      who:
        allIds.length > 0 && allIds.every((i) => existingIds.includes(i)) && !isNew
          ? 'ANY'
          : isNew
            ? 'ANY'
            : 'PLANS',
      plan_ids: existingIds,
      min_tier: undefined,
      allow_grace: existing?.allow_grace ?? true,
      non_member_view: existing?.non_member_view ?? 'EXCERPT_CTA',
      lock_title: existing?.lock_title ?? '',
      lock_message: existing?.lock_message ?? '',
      cta_label: existing?.cta_label ?? 'See plans',
      cta_url: existing?.cta_url ?? '/membership',
    },
  })
  const v = watch()
  const selected = new Set(
    v.who === 'ANY'
      ? allIds
      : v.who === 'MIN_TIER'
        ? plans.filter((p) => p.tier >= (v.min_tier ?? 0)).map((p) => p.id)
        : v.plan_ids
  )
  const names = plans.filter((p) => selected.has(p.id)).map((p) => p.name)
  const lockTitle =
    v.lock_title ||
    (v.who !== 'ANY' && names.length ? `For ${names.join(', ')} members` : 'Members only')

  async function onSubmit(d: AccessRuleData) {
    const next: PlanRule = {
      target: d.target,
      value: d.value.trim(),
      label: d.label || undefined,
      non_member_view: d.non_member_view,
      enabled: existing?.enabled ?? true,
      // honoured once the API stores them (needs-A3)
      allow_grace: d.allow_grace,
      lock_title: d.lock_title || undefined,
      lock_message: d.lock_message || undefined,
      cta_label: d.cta_label || undefined,
      cta_url: d.cta_url || undefined,
    }
    try {
      for (const u of planUpdates(plans, original, next, selected))
        await action.mutateAsync({
          method: 'put',
          path: `plans/${u.planId}/access-rules`,
          data: u.rules,
        })
      toast({ title: 'Access rule saved' })
      router.push('/admin/membership/access-rules')
    } catch {
      /* shown via action.error */
    }
  }

  async function remove() {
    try {
      for (const u of planUpdates(plans, original, null, new Set()))
        await action.mutateAsync({
          method: 'put',
          path: `plans/${u.planId}/access-rules`,
          data: u.rules,
        })
      toast({ title: 'Access rule deleted' })
      router.push('/admin/membership/access-rules')
    } catch {
      setConfirmDelete(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={isNew ? 'New access rule' : (existing?.label ?? existing?.value ?? 'Access rule')}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Access rules', href: '/admin/membership/access-rules' },
          { label: isNew ? 'New' : 'Edit' },
        ]}
        action={
          <div className="flex gap-3">
            {!isNew && (
              <Button
                variant="outline"
                className="border-destructive text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                Delete rule
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push('/admin/membership/access-rules')}>
              Cancel
            </Button>
            <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
              Save rule
            </Button>
          </div>
        }
      />
      <form
        className="grid items-start gap-6 xl:grid-cols-[1fr_380px]"
        onSubmit={handleSubmit(onSubmit)}
      >
        <div className="space-y-6">
          <Card title="What to protect">
            <div className="space-y-4">
              <Controller
                control={control}
                name="target"
                render={({ field }) => (
                  <Segmented
                    label="What to protect"
                    value={field.value}
                    onChange={field.onChange}
                    options={TARGETS.map((t) => ({ value: t, label: TARGET_LABEL[t]! }))}
                  />
                )}
              />
              <FormField
                label={TARGET_LABEL[v.target] ?? 'Resource'}
                error={errors.value?.message}
                required
                hint={
                  v.target === 'URL_PATTERN'
                    ? 'Use * as a wildcard, e.g. /p/resources/*'
                    : undefined
                }
              >
                <Input placeholder={PLACEHOLDER[v.target]} {...register('value')} />
              </FormField>
              <FormField label="Name (optional)" hint="Shown in the list instead of the path">
                <Input placeholder="Annual Report 2026" {...register('label')} />
              </FormField>
            </div>
          </Card>
          <Card title="Who can access">
            <div className="space-y-4 text-sm">
              <Controller
                control={control}
                name="who"
                render={({ field }) => (
                  <Segmented
                    label="Who can access"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'ANY', label: 'Any active member' },
                      { value: 'PLANS', label: 'Specific plans' },
                      { value: 'MIN_TIER', label: 'Minimum tier' },
                    ]}
                  />
                )}
              />
              {v.who === 'PLANS' && (
                <div>
                  <div className="flex flex-wrap gap-3">
                    {plans.map((p) => (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 rounded-full border px-3 py-1"
                      >
                        <input
                          type="checkbox"
                          checked={v.plan_ids.includes(p.id)}
                          onChange={(e) =>
                            setValue(
                              'plan_ids',
                              e.target.checked
                                ? [...v.plan_ids, p.id]
                                : v.plan_ids.filter((i) => i !== p.id),
                              { shouldValidate: true }
                            )
                          }
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  {errors.plan_ids?.message && (
                    <p className="mt-1 text-xs text-destructive">{errors.plan_ids.message}</p>
                  )}
                </div>
              )}
              {v.who === 'MIN_TIER' && (
                <FormField
                  label="Minimum tier"
                  hint={`Includes: ${names.join(', ') || 'no plans'}`}
                >
                  <NativeSelect
                    aria-label="Minimum tier"
                    value={String(v.min_tier ?? '')}
                    placeholder="Choose a tier…"
                    onChange={(e) =>
                      setValue(
                        'min_tier',
                        e.target.value === '' ? undefined : Number(e.target.value)
                      )
                    }
                    options={[...new Map(plans.map((p) => [p.tier, p])).values()]
                      .sort((a, b) => a.tier - b.tier)
                      .map((p) => ({
                        value: String(p.tier),
                        label: `Tier ${p.tier} (${p.name} and above)`,
                      }))}
                  />
                </FormField>
              )}
              <Controller
                control={control}
                name="allow_grace"
                render={({ field }) => (
                  <ToggleRow
                    label="Allow during grace period"
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="What non-members see">
            <div className="space-y-4">
              <Controller
                control={control}
                name="non_member_view"
                render={({ field }) => (
                  <Segmented
                    label="What non-members see"
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      { value: 'HIDDEN', label: 'Hide' },
                      { value: 'BLUR', label: 'Blur' },
                      { value: 'EXCERPT_CTA', label: 'Excerpt' },
                    ]}
                  />
                )}
              />
              <FormField label="Lock title">
                <Input placeholder="For Gold members" {...register('lock_title')} />
              </FormField>
              <FormField label="Message">
                <Textarea
                  rows={2}
                  placeholder="Join or upgrade to read the full report."
                  {...register('lock_message')}
                />
              </FormField>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Button">
                  <Input {...register('cta_label')} />
                </FormField>
                <FormField label="Link" error={errors.cta_url?.message}>
                  <Input {...register('cta_url')} />
                </FormField>
              </div>
              <div className="rounded-lg border bg-muted/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">Preview</p>
                <p className="mt-1 font-semibold">{lockTitle}</p>
                {v.lock_message && (
                  <p className="text-sm text-muted-foreground">{v.lock_message}</p>
                )}
                {v.non_member_view !== 'HIDDEN' && (
                  <span className="mt-2 inline-block rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground">
                    {v.cta_label || 'See plans'}
                  </span>
                )}
                {v.non_member_view === 'HIDDEN' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Non-members do not see this at all.
                  </p>
                )}
              </div>
            </div>
          </Card>
          {action.error ? <ErrorAlert error={action.error} /> : null}
        </div>
      </form>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete rule?"
        description="The resource becomes visible to everyone again."
        isLoading={action.isPending}
        onConfirm={() => void remove()}
      />
    </div>
  )
}
