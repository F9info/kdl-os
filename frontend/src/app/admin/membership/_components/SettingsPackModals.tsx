'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormField } from '@/components/shared/FormField'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import {
  useAdminAction,
  useAdminItem,
  useFieldGroups,
  type FieldGroup,
} from '@/admin/hooks/useMembership'
import { packSchema, type PackData } from '../_billing-schemas'
import { BModal, ModalButtons, ModalError, Segmented, ToggleRow } from './BillingBits'
import { NativeSelect } from './ui'

interface Preset {
  key: string
  name: string
  field_count: number
  fields: Array<{ label: string }>
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)

/** "Apply a sector preset": pick one or more; applying never deletes data. */
export function PresetModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data } = useAdminItem<{ items: Preset[] }>(open ? 'field-groups/presets' : null)
  const action = useAdminAction()
  const [picked, setPicked] = useState<string[]>([])
  const [blank, setBlank] = useState(false)
  const toggle = (k: string) => {
    setBlank(false)
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))
  }
  const close = () => {
    setPicked([])
    setBlank(false)
    action.reset()
    onClose()
  }
  async function apply() {
    try {
      for (const preset of picked)
        await action.mutateAsync({ path: 'field-groups/presets/apply', data: { preset } })
      toast({ title: `${picked.length} preset${picked.length === 1 ? '' : 's'} applied` })
      close()
    } catch {
      /* shown below */
    }
  }
  return (
    <BModal
      wide
      open={open}
      onClose={close}
      tone="info"
      title="Apply a sector preset"
      sub="Pick one or more. Presets switch on ready-made packs — you can edit every field afterwards."
      footer={
        <ModalButtons
          onCancel={close}
          pending={action.isPending}
          disabled={!blank && picked.length === 0}
          confirmLabel={
            blank ? 'Start blank' : `Apply ${picked.length} preset${picked.length === 1 ? '' : 's'}`
          }
          onConfirm={() => (blank ? close() : void apply())}
        />
      }
    >
      <div className="space-y-2">
        {(data?.items ?? []).map((p) => (
          <label
            key={p.key}
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              className="mt-1"
              checked={picked.includes(p.key)}
              onChange={() => toggle(p.key)}
            />
            <span>
              <span className="block font-medium">{p.name}</span>
              <span className="block text-xs text-muted-foreground">
                {p.fields
                  .slice(0, 6)
                  .map((f) => f.label)
                  .join(', ')}
              </span>
            </span>
          </label>
        ))}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={blank}
            onChange={(e) => {
              setBlank(e.target.checked)
              if (e.target.checked) setPicked([])
            }}
          />
          <span>
            <span className="block font-medium">Start blank</span>
            <span className="block text-xs text-muted-foreground">
              Only core fields — add your own packs
            </span>
          </span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground">
        Applying a preset never deletes data. Existing member answers stay attached to their fields.
      </p>
      <ModalError error={action.error} />
    </BModal>
  )
}

/** "New field pack": name, description, who it applies to, sign-up behaviour. */
export function NewPackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const action = useAdminAction()
  const { data: groups } = useFieldGroups()
  const [from, setFrom] = useState<'BLANK' | 'COPY'>('BLANK')
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<PackData>({
    resolver: zodResolver(packSchema),
    defaultValues: {
      name: '',
      description: '',
      applies_to: 'INDIVIDUAL',
      ask_at_signup: true,
      member_editable: true,
      requires_review: false,
      show_in_directory: false,
    },
  })
  const close = () => {
    reset()
    setFrom('BLANK')
    action.reset()
    onClose()
  }
  const submit = handleSubmit(async (v) => {
    const source: FieldGroup | undefined =
      from === 'COPY' ? groups?.items.find((g) => g.id === v.copy_from) : undefined
    const keys = new Set((groups?.items ?? []).map((g) => g.key))
    let key = slug(v.name) || 'pack'
    for (let i = 2; keys.has(key); i++) key = `${slug(v.name)}_${i}`
    const { name, description, ...rest } = { ...v, copy_from: undefined }
    action.mutate(
      {
        path: 'field-groups',
        data: {
          ...rest,
          name,
          key,
          description: description || undefined,
          fields: (source?.fields ?? []).map((f) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            options: f.options,
            required: f.required,
            visibility: f.visibility,
          })),
        },
      },
      {
        onSuccess: (d) => {
          toast({ title: 'Pack created' })
          close()
          const id = (d as { id?: string } | undefined)?.id
          if (id) router.push(`/admin/membership/settings/fields/${id}`)
        },
      }
    )
  })
  return (
    <BModal
      open={open}
      onClose={close}
      tone="info"
      title="New field pack"
      sub="A group of fields you can ask in any plan"
      footer={
        <ModalButtons
          onCancel={close}
          pending={action.isPending}
          confirmLabel="Create pack"
          onConfirm={() => void submit()}
        />
      }
    >
      <form className="space-y-4" onSubmit={submit}>
        <FormField label="Pack name" error={errors.name?.message} required>
          <Input placeholder="Event preferences" {...register('name')} />
        </FormField>
        <FormField label="Description">
          <Input
            placeholder="Dietary choice, T-shirt size, session interests"
            {...register('description')}
          />
        </FormField>
        <div>
          <p className="mb-1 text-sm font-medium">Applies to</p>
          <Controller
            control={control}
            name="applies_to"
            render={({ field }) => (
              <Segmented
                label="Applies to"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'INDIVIDUAL', label: 'Individual' },
                  { value: 'ORGANISATION', label: 'Organisation' },
                  { value: 'BOTH', label: 'Both' },
                ]}
              />
            )}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">Start from</p>
          <Segmented
            label="Start from"
            value={from}
            onChange={setFrom}
            options={[
              { value: 'BLANK', label: 'Blank' },
              { value: 'COPY', label: 'Copy a pack' },
            ]}
          />
          {from === 'COPY' && (
            <div className="mt-2">
              <NativeSelect
                aria-label="Pack to copy"
                placeholder="Choose a pack…"
                options={(groups?.items ?? []).map((g) => ({ value: g.id, label: g.name }))}
                {...register('copy_from')}
              />
            </div>
          )}
        </div>
        <Controller
          control={control}
          name="ask_at_signup"
          render={({ field }) => (
            <ToggleRow
              label="Ask at sign-up"
              hint="Shown in the Details step for plans that include it"
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="member_editable"
          render={({ field }) => (
            <ToggleRow
              label="Member can edit after joining"
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
        <ModalError error={action.error} />
      </form>
    </BModal>
  )
}
