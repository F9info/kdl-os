'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAction, type MemberType, type Plan } from '@/admin/hooks/useMembership'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { planSchema, type PlanFormData } from '../_schemas'
import { PlanCardPreview } from './PlanCardPreview'
import { NativeSelect } from './ui'

const DEFAULTS: PlanFormData = {
  name: '',
  slug: '',
  description: '',
  tier: 1,
  color: '#2563eb',
  is_free: false,
  approval_mode: 'AUTO',
  visibility: 'PUBLIC',
  trial_days: 0,
  max_contacts: 5,
  is_featured: false,
  member_types: ['INDIVIDUAL'],
  badge: '',
  seat_limit: null,
  allow_self_cancel: true,
  allow_plan_change: true,
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex overflow-hidden rounded-md border">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3 py-1.5 text-sm',
            value === o.value ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const TYPE_CHOICES: Array<{ value: 'INDIVIDUAL' | 'ORGANISATION' | 'BOTH'; label: string }> = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'ORGANISATION', label: 'Organisation' },
  { value: 'BOTH', label: 'Both' },
]
const typesToChoice = (t: MemberType[]) =>
  t.length > 1 ? 'BOTH' : t[0] === 'ORGANISATION' ? 'ORGANISATION' : 'INDIVIDUAL'
const choiceToTypes = (c: string): MemberType[] =>
  c === 'BOTH' ? ['INDIVIDUAL', 'ORGANISATION'] : [c as MemberType]

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4 border-b py-3 text-sm last:border-b-0">
    <span className="whitespace-nowrap">{label}</span>
    {children}
  </div>
)

/**
 * Details tab: create (no plan) or edit (plan). Renders the two-column layout of the mockup:
 * basics on the left (children = pricing/benefits summaries), behaviour + live card preview on the right.
 * Submit with the form id (header "Save plan" button) or `submitLabel` button when `inlineSubmit`.
 */
export function PlanForm({
  plan,
  onSaved,
  formId = 'plan-form',
  asDraft,
  children,
}: {
  plan?: Plan
  onSaved?: (p: Plan) => void
  formId?: string
  /** set by "Save as draft": saves the plan hidden */
  asDraft?: { current: boolean }
  children?: React.ReactNode
}) {
  const action = useAdminAction()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          ...DEFAULTS,
          ...plan,
          description: plan.description ?? '',
          color: plan.color ?? '#2563eb',
          badge: plan.badge ?? '',
          seat_limit: plan.seat_limit ?? null,
          allow_self_cancel: plan.allow_self_cancel ?? true,
          allow_plan_change: plan.allow_plan_change ?? true,
        }
      : DEFAULTS,
  })
  const [name, badge, isFree, memberTypes] = watch(['name', 'badge', 'is_free', 'member_types'])

  function onSubmit(values: PlanFormData) {
    const body = {
      ...values,
      badge: values.badge || null,
      is_featured: values.is_featured || Boolean(values.badge),
      ...(asDraft?.current ? { visibility: 'HIDDEN' } : {}),
    }
    action.mutate(
      plan
        ? { method: 'patch', path: `plans/${plan.id}`, data: body }
        : { path: 'plans', data: body },
      {
        onSuccess: (saved) => {
          toast({
            title: plan ? 'Plan saved' : asDraft?.current ? 'Draft saved' : 'Plan created',
          })
          onSaved?.(saved as Plan)
        },
      }
    )
  }

  return (
    <form
      id={formId}
      className="grid gap-5 lg:grid-cols-[2fr_1fr]"
      onSubmit={handleSubmit(onSubmit)}
      noValidate
    >
      <div className="space-y-5">
        <section className="space-y-4 rounded-lg border bg-card p-5">
          {!plan && <h2 className="text-base font-semibold">Basics</h2>}
          <FormField label="Plan name" error={errors.name?.message} required>
            <Input
              placeholder="e.g. Platinum"
              {...register('name', {
                onChange: (e) =>
                  !plan && !dirtyFields.slug && setValue('slug', slugify(e.target.value)),
              })}
            />
          </FormField>
          {!plan && (
            <FormField
              label="URL slug"
              error={errors.slug?.message}
              hint="Shown in yoursite.com/membership/join/<slug>"
            >
              <Input {...register('slug')} />
            </FormField>
          )}
          <FormField label="Description" error={errors.description?.message}>
            <Textarea rows={3} placeholder="What members get…" {...register('description')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Tier level" error={errors.tier?.message} hint="Higher = more access">
              <Input type="number" {...register('tier', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Badge (optional)">
              <Input placeholder="e.g. Best value" {...register('badge')} />
            </FormField>
            <FormField label="Seat limit" error={errors.seat_limit?.message}>
              <Input
                type="number"
                placeholder="Unlimited"
                {...register('seat_limit', {
                  setValueAs: (v) =>
                    v === '' || v === null || Number.isNaN(Number(v)) ? null : Number(v),
                })}
              />
            </FormField>
          </div>
          {!plan && (
            <FormField label="Icon & colour">
              <Input type="color" className="h-10 w-20 p-1" {...register('color')} />
            </FormField>
          )}
        </section>
        {children}
      </div>
      <div className="space-y-5">
        <section className="rounded-lg border bg-card p-5">
          <h2 className="mb-2 text-base font-semibold">Behaviour</h2>
          <Row label="Free plan">
            <Controller
              control={control}
              name="is_free"
              render={({ field }) => (
                <Switch
                  aria-label="Free plan"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Row>
          <Row label="Trial days">
            <Input
              type="number"
              className="w-20"
              aria-label="Trial days"
              {...register('trial_days', { valueAsNumber: true })}
            />
          </Row>
          <Row label="Approval">
            <Controller
              control={control}
              name="approval_mode"
              render={({ field }) => (
                <Segmented
                  label="Approval"
                  value={field.value}
                  onChange={field.onChange}
                  options={[
                    { value: 'AUTO', label: 'Auto' },
                    { value: 'MANUAL', label: 'Manual' },
                  ]}
                />
              )}
            />
          </Row>
          <Row label="Visibility">
            <NativeSelect
              aria-label="Visibility"
              className="w-36"
              options={[
                { value: 'PUBLIC', label: 'Public' },
                { value: 'HIDDEN', label: 'Invite only' },
                { value: 'ARCHIVED', label: 'Archived' },
              ]}
              {...register('visibility')}
            />
          </Row>
          <Row label="Who can join">
            <Segmented
              label="Who can join"
              value={typesToChoice(memberTypes)}
              onChange={(c) => setValue('member_types', choiceToTypes(c), { shouldDirty: true })}
              options={TYPE_CHOICES}
            />
          </Row>
          {memberTypes.includes('ORGANISATION') && (
            <Row label="Contacts per organisation">
              <Input
                type="number"
                className="w-20"
                aria-label="Contacts per organisation"
                {...register('max_contacts', { valueAsNumber: true })}
              />
            </Row>
          )}
          <Row label="Allow self-cancel">
            <Controller
              control={control}
              name="allow_self_cancel"
              render={({ field }) => (
                <Switch
                  aria-label="Allow self-cancel"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Row>
          <Row label="Allow plan change">
            <Controller
              control={control}
              name="allow_plan_change"
              render={({ field }) => (
                <Switch
                  aria-label="Allow plan change"
                  checked={Boolean(field.value)}
                  onCheckedChange={field.onChange}
                />
              )}
            />
          </Row>
          {errors.member_types && (
            <p role="alert" className="text-xs text-destructive">
              {errors.member_types.message}
            </p>
          )}
          {errors.max_contacts && (
            <p role="alert" className="text-xs text-destructive">
              {errors.max_contacts.message}
            </p>
          )}
        </section>
        <PlanCardPreview
          plan={plan ? { ...plan, is_free: isFree } : undefined}
          name={name}
          badge={badge}
        />
        {action.error && <ErrorAlert error={action.error} />}
      </div>
    </form>
  )
}
