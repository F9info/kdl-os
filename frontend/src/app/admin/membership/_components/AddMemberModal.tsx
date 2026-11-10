'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { useAdminAction, usePlans, type Member } from '@/admin/hooks/useMembership'
import { memberSchema, type MemberFormData } from '../_schemas'
import { NativeSelect } from './ui'

const EMPTY: MemberFormData = {
  member_type: 'INDIVIDUAL',
  full_name: '',
  email: '',
  mobile: '',
  legal_name: '',
  gstin: '',
  plan_id: '',
  complimentary: false,
}

/** Offline / walk-in member. Individual and Organisation share one form; org-only fields show on switch. */
export function AddMemberModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated?: (m: Member) => void
}) {
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MemberFormData>({ resolver: zodResolver(memberSchema), defaultValues: EMPTY })
  const type = watch('member_type')

  function close() {
    reset(EMPTY)
    action.reset()
    onClose()
  }

  function onSubmit(v: MemberFormData) {
    const body = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== ''))
    action.mutate(
      { path: 'members', data: body },
      {
        onSuccess: (m) => {
          toast({ title: 'Member added' })
          onCreated?.(m as Member)
          close()
        },
      }
    )
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add member"
      description="Offline, walk-in or complimentary membership."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
            Add member
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div role="radiogroup" aria-label="Member type" className="flex gap-2">
          {(['INDIVIDUAL', 'ORGANISATION'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              role="radio"
              aria-checked={type === t}
              variant={type === t ? 'default' : 'outline'}
              onClick={() => setValue('member_type', t)}
            >
              {t === 'INDIVIDUAL' ? 'Individual' : 'Organisation'}
            </Button>
          ))}
        </div>
        {type === 'ORGANISATION' && (
          <>
            <FormField label="Company name" error={errors.legal_name?.message} required>
              <Input {...register('legal_name')} />
            </FormField>
            <FormField label="GSTIN">
              <Input {...register('gstin')} />
            </FormField>
          </>
        )}
        <FormField
          label={type === 'ORGANISATION' ? 'Primary contact name' : 'Full name'}
          error={errors.full_name?.message}
          required
        >
          <Input {...register('full_name')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Email" error={errors.email?.message} required>
            <Input type="email" {...register('email')} />
          </FormField>
          <FormField label="Mobile">
            <Input {...register('mobile')} />
          </FormField>
        </div>
        <FormField label="Plan">
          <NativeSelect
            placeholder="No plan yet"
            options={(plans?.items ?? [])
              .filter((p) => p.member_types.includes(type))
              .map((p) => ({ value: p.id, label: p.name }))}
            {...register('plan_id')}
          />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('complimentary')} /> Complimentary (no payment)
        </label>
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}
