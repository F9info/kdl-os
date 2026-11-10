'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAdminAction, type Plan } from '@/admin/hooks/useMembership'
import { toast } from '@/hooks/use-toast'
import { planSchema, type PlanFormData } from '../_schemas'
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
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Create (no plan) or edit (plan) the plan's own fields. */
export function PlanForm({ plan, onSaved }: { plan?: Plan; onSaved?: (p: Plan) => void }) {
  const action = useAdminAction()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: plan
      ? {
          ...DEFAULTS,
          ...plan,
          description: plan.description ?? '',
          color: plan.color ?? '#2563eb',
        }
      : DEFAULTS,
  })

  function onSubmit(values: PlanFormData) {
    action.mutate(
      plan
        ? { method: 'patch', path: `plans/${plan.id}`, data: values }
        : { path: 'plans', data: values },
      {
        onSuccess: (saved) => {
          toast({ title: plan ? 'Plan saved' : 'Plan created' })
          onSaved?.(saved as Plan)
        },
      }
    )
  }

  return (
    <form className="max-w-2xl space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Plan name" error={errors.name?.message} required>
          <Input
            {...register('name', {
              onChange: (e) =>
                !plan && !dirtyFields.slug && setValue('slug', slugify(e.target.value)),
            })}
          />
        </FormField>
        <FormField label="Slug" error={errors.slug?.message} required hint="Used in the join URL">
          <Input {...register('slug')} />
        </FormField>
      </div>
      <FormField label="Description" error={errors.description?.message}>
        <Textarea rows={2} {...register('description')} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Tier" error={errors.tier?.message} hint="Higher = more access">
          <Input type="number" {...register('tier', { valueAsNumber: true })} />
        </FormField>
        <FormField label="Colour">
          <Input type="color" {...register('color')} />
        </FormField>
        <FormField label="Trial days" error={errors.trial_days?.message}>
          <Input type="number" {...register('trial_days', { valueAsNumber: true })} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Approval">
          <NativeSelect
            options={[
              { value: 'AUTO', label: 'Automatic' },
              { value: 'MANUAL', label: 'Manual review' },
            ]}
            {...register('approval_mode')}
          />
        </FormField>
        <FormField label="Visibility">
          <NativeSelect
            options={[
              { value: 'PUBLIC', label: 'Public' },
              { value: 'HIDDEN', label: 'Invite only' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
            {...register('visibility')}
          />
        </FormField>
        <FormField label="Max contacts (organisations)" error={errors.max_contacts?.message}>
          <Input type="number" {...register('max_contacts', { valueAsNumber: true })} />
        </FormField>
      </div>
      <Controller
        control={control}
        name="member_types"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Who can join</legend>
            <div className="flex gap-4 text-sm">
              {(['INDIVIDUAL', 'ORGANISATION'] as const).map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.value.includes(t)}
                    onChange={(e) =>
                      field.onChange(
                        e.target.checked ? [...field.value, t] : field.value.filter((x) => x !== t)
                      )
                    }
                  />
                  {t === 'INDIVIDUAL' ? 'Individual' : 'Organisation'}
                </label>
              ))}
            </div>
            {errors.member_types && (
              <p role="alert" className="text-xs text-destructive">
                {errors.member_types.message}
              </p>
            )}
          </fieldset>
        )}
      />
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('is_free')} /> Free plan
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" {...register('is_featured')} /> Most popular badge
        </label>
      </div>
      {action.error && <ErrorAlert error={action.error} />}
      <Button type="submit" disabled={action.isPending}>
        {plan ? 'Save plan' : 'Create plan'}
      </Button>
    </form>
  )
}
