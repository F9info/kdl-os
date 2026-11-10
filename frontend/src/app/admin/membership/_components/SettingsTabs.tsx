'use client'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { toast } from '@/hooks/use-toast'
import {
  FIELD_TYPES,
  useAdminAction,
  useFieldGroups,
  useSettings,
  type FieldDef,
  type FieldGroup,
  type Settings,
} from '@/admin/hooks/useMembership'
import {
  fieldSchema,
  groupSchema,
  settingsSchema,
  type FieldFormData,
  type GroupFormData,
  type SettingsFormData,
} from '../_schemas'
import { Card, NativeSelect, enumOptions, humanize } from './ui'

const PRESETS = [
  'Business',
  'Professional',
  'Education',
  'Community',
  'Residential',
  'Club',
  'Documents',
]

function toForm(s: Settings): SettingsFormData {
  return {
    ...s.general,
    renewal_rules: s.general.renewal_rules ?? '',
    policies: s.general.policies ?? '',
    ...s.signup,
  }
}
function toPayload(v: SettingsFormData): Settings {
  const {
    primary_login,
    allow_email_password,
    require_approval_default,
    member_types,
    ...general
  } = v
  return {
    general,
    signup: { primary_login, allow_email_password, require_approval_default, member_types },
  }
}

function SettingsForm({
  settings,
  section,
}: {
  settings: Settings
  section: 'general' | 'signup'
}) {
  const action = useAdminAction()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: toForm(settings),
  })
  return (
    <form
      className="max-w-2xl space-y-4"
      onSubmit={handleSubmit((v) =>
        action.mutate(
          { method: 'put', path: 'settings', data: toPayload(v) },
          { onSuccess: () => toast({ title: 'Settings saved' }) }
        )
      )}
    >
      {section === 'general' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Member number prefix" error={errors.member_no_prefix?.message}>
              <Input {...register('member_no_prefix')} />
            </FormField>
            <FormField label="Invoice prefix" error={errors.invoice_prefix?.message}>
              <Input {...register('invoice_prefix')} />
            </FormField>
            <FormField label="Default GST %" error={errors.gst_rate_default?.message}>
              <Input type="number" {...register('gst_rate_default', { valueAsNumber: true })} />
            </FormField>
            <FormField label="Grace period (days)" error={errors.grace_days?.message}>
              <Input type="number" {...register('grace_days', { valueAsNumber: true })} />
            </FormField>
          </div>
          <FormField label="Renewal rules">
            <Textarea rows={3} {...register('renewal_rules')} />
          </FormField>
          <FormField label="Policies (refund, cancellation)">
            <Textarea rows={3} {...register('policies')} />
          </FormField>
        </>
      ) : (
        <>
          <FormField label="Primary login">
            <NativeSelect
              options={[
                { value: 'MOBILE_OTP', label: 'Mobile number + OTP' },
                { value: 'EMAIL', label: 'Email + password' },
              ]}
              {...register('primary_login')}
            />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('allow_email_password')} /> Also allow email +
            password
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" {...register('require_approval_default')} /> New plans need
            approval by default
          </label>
          <Controller
            control={control}
            name="member_types"
            render={({ field }) => (
              <fieldset className="flex gap-4 text-sm">
                <legend className="mb-1 font-medium">Member types</legend>
                {(['INDIVIDUAL', 'ORGANISATION'] as const).map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={field.value.includes(t)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.checked
                            ? [...field.value, t]
                            : field.value.filter((x) => x !== t)
                        )
                      }
                    />
                    {humanize(t)}
                  </label>
                ))}
              </fieldset>
            )}
          />
        </>
      )}
      {action.error && <ErrorAlert error={action.error} />}
      <Button type="submit" disabled={action.isPending}>
        Save settings
      </Button>
    </form>
  )
}

export function GeneralTab() {
  const { data } = useSettings()
  return (
    <Card title="General">
      {data ? <SettingsForm settings={data} section="general" /> : 'Loading…'}
    </Card>
  )
}

function FieldModal({
  group,
  field,
  onClose,
}: {
  group: FieldGroup
  field: FieldDef | 'new' | null
  onClose: () => void
}) {
  const action = useAdminAction()
  const editing = field && field !== 'new' ? field : null
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FieldFormData>({
    resolver: zodResolver(fieldSchema),
    values: {
      label: editing?.label ?? '',
      key: editing?.key ?? '',
      type: editing?.type ?? 'TEXT',
      options: (editing?.options ?? []).join(', '),
      required: editing?.required ?? false,
      is_unique: editing?.is_unique ?? false,
      visibility: editing?.visibility ?? 'EDIT',
    },
  })
  const type = watch('type')
  const onSubmit = ({ options, ...v }: FieldFormData) => {
    const data = {
      ...v,
      options: options
        ? options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    }
    action.mutate(
      editing
        ? { method: 'patch', path: `fields/${editing.id}`, data }
        : { path: `field-groups/${group.id}/fields`, data },
      {
        onSuccess: () => {
          toast({ title: 'Field saved' })
          onClose()
        },
      }
    )
  }
  return (
    <Modal
      open={field !== null}
      onClose={onClose}
      title={editing ? 'Edit field' : 'Add field'}
      footer={
        <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
          Save field
        </Button>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Label" error={errors.label?.message} required>
          <Input {...register('label')} />
        </FormField>
        <FormField
          label="Key"
          error={errors.key?.message}
          required
          hint="Used in imports and the API"
        >
          <Input {...register('key')} />
        </FormField>
        <FormField label="Type">
          <NativeSelect options={enumOptions(FIELD_TYPES)} {...register('type')} />
        </FormField>
        {['SELECT', 'MULTISELECT'].includes(type) && (
          <FormField label="Options" hint="Comma separated">
            <Input {...register('options')} />
          </FormField>
        )}
        <FormField label="Visibility">
          <NativeSelect
            options={[
              { value: 'EDIT', label: 'Member can edit' },
              { value: 'VIEW', label: 'Member can view only' },
              { value: 'HIDDEN', label: 'Admin only' },
            ]}
            {...register('visibility')}
          />
        </FormField>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('required')} /> Required
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('is_unique')} /> Must be unique
          </label>
        </div>
        {action.error && <ErrorAlert error={action.error} />}
      </form>
    </Modal>
  )
}

function PackModal({ pack, onClose }: { pack: FieldGroup | 'new' | null; onClose: () => void }) {
  const action = useAdminAction()
  const { data } = useFieldGroups()
  const editing =
    pack && pack !== 'new' ? (data?.items.find((g) => g.id === pack.id) ?? pack) : null
  const [field, setField] = useState<FieldDef | 'new' | null>(null)
  const [delField, setDelField] = useState<FieldDef | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    values: {
      name: editing?.name ?? '',
      key: editing?.key ?? '',
      applies_to: editing?.applies_to ?? 'BOTH',
      ask_at_signup: editing?.ask_at_signup ?? true,
      member_editable: editing?.member_editable ?? true,
      requires_review: editing?.requires_review ?? false,
    },
  })
  const onSubmit = (v: GroupFormData) =>
    action.mutate(
      editing
        ? { method: 'patch', path: `field-groups/${editing.id}`, data: v }
        : { path: 'field-groups', data: v },
      {
        onSuccess: () => {
          toast({ title: 'Pack saved' })
          if (!editing) onClose()
        },
      }
    )
  return (
    <Modal
      open={pack !== null}
      onClose={onClose}
      size="lg"
      title={editing ? `Pack: ${editing.name}` : 'New pack'}
      footer={
        <Button onClick={handleSubmit(onSubmit)} disabled={action.isPending}>
          Save pack
        </Button>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Pack name" error={errors.name?.message} required>
            <Input {...register('name')} />
          </FormField>
          <FormField label="Key" error={errors.key?.message} required>
            <Input {...register('key')} disabled={Boolean(editing)} />
          </FormField>
        </div>
        <FormField label="Applies to">
          <NativeSelect
            options={enumOptions(['BOTH', 'INDIVIDUAL', 'ORGANISATION'])}
            {...register('applies_to')}
          />
        </FormField>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('ask_at_signup')} /> Ask at sign-up
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('member_editable')} /> Member can edit later
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" {...register('requires_review')} /> Changes need review
          </label>
        </div>
        {action.error && <ErrorAlert error={action.error} />}
      </form>
      {editing && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Fields ({editing.fields?.length ?? 0})</h3>
            <Button size="sm" variant="outline" onClick={() => setField('new')}>
              <Plus className="h-4 w-4" /> Add field
            </Button>
          </div>
          <ul className="divide-y text-sm">
            {(editing.fields ?? []).map((f) => (
              <li key={f.id} className="flex items-center justify-between py-2">
                <span>
                  {f.label}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({humanize(f.type)}
                    {f.required ? ', required' : ''})
                  </span>
                </span>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${f.label}`}
                    onClick={() => setField(f)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${f.label}`}
                    onClick={() => setDelField(f)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
          <FieldModal group={editing} field={field} onClose={() => setField(null)} />
          <ConfirmDialog
            open={delField !== null}
            onClose={() => setDelField(null)}
            title="Delete field?"
            description="Answers members gave for this field are removed too."
            isLoading={action.isPending}
            onConfirm={() =>
              delField &&
              action.mutate(
                { method: 'delete', path: `fields/${delField.id}` },
                { onSuccess: () => setDelField(null) }
              )
            }
          />
        </div>
      )}
    </Modal>
  )
}

export function SignupTab() {
  const { data: settings } = useSettings()
  const { data: groups } = useFieldGroups()
  const action = useAdminAction()
  const [preset, setPreset] = useState('')
  const [pack, setPack] = useState<FieldGroup | 'new' | null>(null)
  const [delPack, setDelPack] = useState<FieldGroup | null>(null)
  return (
    <>
      <Card title="Sign-up">
        {settings ? <SettingsForm settings={settings} section="signup" /> : 'Loading…'}
      </Card>
      <Card
        title="Profile field packs"
        action={
          <Button size="sm" onClick={() => setPack('new')}>
            <Plus className="h-4 w-4" /> New pack
          </Button>
        }
      >
        <div className="mb-4 flex items-end gap-2">
          <div className="w-56">
            <FormField label="Apply a sector preset">
              <NativeSelect
                placeholder="Choose preset…"
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                options={PRESETS.map((p) => ({ value: p, label: p }))}
              />
            </FormField>
          </div>
          <Button
            variant="outline"
            disabled={!preset || action.isPending}
            onClick={() =>
              action.mutate(
                { path: 'field-groups/presets/apply', data: { preset } },
                { onSuccess: () => toast({ title: `${preset} preset applied` }) }
              )
            }
          >
            Apply preset
          </Button>
        </div>
        {action.error && <ErrorAlert error={action.error} />}
        {(groups?.items ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No packs yet. Apply a preset or create your own.
          </p>
        ) : (
          <ul className="divide-y text-sm">
            {groups!.items.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2">
                <span>
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {humanize(g.applies_to)} · {g.fields?.length ?? 0} fields
                  </span>
                </span>
                <span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${g.name}`}
                    onClick={() => setPack(g)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete ${g.name}`}
                    onClick={() => setDelPack(g)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <PackModal pack={pack} onClose={() => setPack(null)} />
      <ConfirmDialog
        open={delPack !== null}
        onClose={() => setDelPack(null)}
        title="Delete pack?"
        description="The pack and all its fields are removed from every plan."
        isLoading={action.isPending}
        onConfirm={() =>
          delPack &&
          action.mutate(
            { method: 'delete', path: `field-groups/${delPack.id}` },
            { onSuccess: () => setDelPack(null) }
          )
        }
      />
    </>
  )
}
