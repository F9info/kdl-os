'use client'

import { useState } from 'react'
import { GripVertical, Plus } from 'lucide-react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/hooks/use-toast'
import {
  useAdminAction,
  useAdminItem,
  usePlans,
  type FieldDef,
  type FieldGroup,
} from '@/admin/hooks/useMembership'
import { packSchema, type PackData } from '../_billing-schemas'
import { BModal, DetailRow, ModalButtons, Segmented, ToggleRow, fmtDate } from './BillingBits'
import { FieldModal, TYPE_LABEL, ruleText } from './SettingsFieldModal'
import { Card, humanize } from './ui'

type Pack = FieldGroup & {
  description?: string | null
  show_in_directory?: boolean
  updated_at?: string
  member_count?: number
}

const VISIBLE = { EDIT: 'Member edits', VIEW: 'Member views', HIDDEN: 'Admin only' } as const

function PackForm({ pack }: { pack: Pack }) {
  const action = useAdminAction()
  const { data: plans } = usePlans()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<PackData>({
    resolver: zodResolver(packSchema),
    defaultValues: {
      name: pack.name,
      description: pack.description ?? '',
      applies_to: pack.applies_to,
      ask_at_signup: pack.ask_at_signup,
      member_editable: pack.member_editable,
      requires_review: pack.requires_review,
      show_in_directory: pack.show_in_directory ?? false,
    },
  })
  const usedBy = (plans?.items ?? []).filter((p) =>
    p.field_groups?.some((g) => g.group_id === pack.id)
  )
  const save = handleSubmit((v) => {
    const data = { ...v, copy_from: undefined }
    action.mutate(
      { method: 'patch', path: `field-groups/${pack.id}`, data },
      { onSuccess: () => toast({ title: 'Pack saved' }) }
    )
  })
  return (
    <>
      <form id="settings-pack-form" onSubmit={save} className="space-y-4">
        <FormField label="Pack name" error={errors.name?.message} required>
          <Input {...register('name')} />
        </FormField>
        <FormField label="Description">
          <Input {...register('description')} />
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
        {(
          [
            ['ask_at_signup', 'Ask at sign-up', 'Shown in the Details step'],
            ['member_editable', 'Member can edit after joining', undefined],
            ['requires_review', 'Changes need admin check', 'A member’s edits wait for approval'],
            ['show_in_directory', 'Show in member directory', undefined],
          ] as const
        ).map(([k, label, hint]) => (
          <Controller
            key={k}
            control={control}
            name={k}
            render={({ field }) => (
              <ToggleRow
                label={label}
                hint={hint}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        ))}
        {action.error ? <ErrorAlert error={action.error} /> : null}
      </form>
      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold">Used by plans</h3>
        {usedBy.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plan asks for this pack yet.</p>
        ) : (
          usedBy.map((p) => (
            <DetailRow key={p.id} label={p.name}>
              {humanize(p.field_groups?.find((g) => g.group_id === pack.id)?.member_type ?? 'ALL')}{' '}
              members
            </DetailRow>
          ))
        )}
      </div>
      <div className="mt-6">
        <h3 className="mb-1 text-sm font-semibold">Answers stored</h3>
        <DetailRow label="Members with answers">{pack.member_count ?? '—'}</DetailRow>
        <DetailRow label="Last change">{fmtDate(pack.updated_at)}</DetailRow>
      </div>
    </>
  )
}

function PreviewModal({ pack, open, onClose }: { pack: Pack; open: boolean; onClose: () => void }) {
  return (
    <BModal
      open={open}
      onClose={onClose}
      tone="info"
      title={`${pack.name} · form preview`}
      sub="What the member sees in the Details step"
      footer={
        <ModalButtons
          onCancel={onClose}
          cancelLabel="Close"
          confirmLabel="Done"
          onConfirm={onClose}
        />
      }
    >
      {(pack.fields ?? [])
        .filter((f) => f.visibility !== 'HIDDEN')
        .map((f) => (
          <FormField key={f.id} label={f.label} required={f.required}>
            {f.type === 'SELECT' || f.type === 'MULTISELECT' ? (
              <select
                disabled
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option>{f.options[0] ?? 'Choose…'}</option>
              </select>
            ) : (
              <Input
                disabled
                type={f.type === 'DATE' ? 'date' : 'text'}
                placeholder={TYPE_LABEL[f.type]}
              />
            )}
          </FormField>
        ))}
    </BModal>
  )
}

export function SettingsPack({ id }: { id: string }) {
  const { data: groups, isLoading, error } = useAdminItem<{ items: Pack[] }>('field-groups')
  const pack = groups?.items.find((g) => g.id === id)
  const action = useAdminAction()
  const [field, setField] = useState<FieldDef | 'new' | null>(null)
  const [del, setDel] = useState<FieldDef | null>(null)
  const [preview, setPreview] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const fields = [...(pack?.fields ?? [])].sort((a, b) => a.sort - b.sort)

  function drop(overId: string) {
    if (!dragId || dragId === overId) return
    const ids = fields.map((f) => f.id)
    ids.splice(ids.indexOf(overId), 0, ids.splice(ids.indexOf(dragId), 1)[0]!)
    ids.forEach((fid, i) => {
      if (fields.find((f) => f.id === fid)?.sort !== i)
        action.mutate({ method: 'patch', path: `fields/${fid}`, data: { sort: i } })
    })
    setDragId(null)
  }

  return (
    <div>
      <PageHeader
        title={pack?.name ?? 'Field pack'}
        breadcrumbs={[
          { label: 'Membership', href: '/admin/membership' },
          { label: 'Settings', href: '/admin/membership/settings' },
          { label: 'Sign-up & profile', href: '/admin/membership/settings?tab=signup' },
          { label: 'Pack' },
        ]}
        action={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setPreview(true)} disabled={!pack}>
              Preview form
            </Button>
            <Button type="submit" form="settings-pack-form" disabled={!pack}>
              Save pack
            </Button>
          </div>
        }
      />
      {error ? <ErrorAlert error={error} /> : null}
      {isLoading || !pack ? (
        isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <p className="text-sm text-muted-foreground">Pack not found.</p>
        )
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
          <Card
            title={`Fields · ${fields.length}`}
            action={
              <Button size="sm" onClick={() => setField('new')}>
                <Plus className="h-4 w-4" /> Add field
              </Button>
            }
          >
            <p className="-mt-3 mb-3 text-xs text-muted-foreground">
              Drag to reorder. Keys are used in exports, imports and the API.
            </p>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground">No fields yet. Add the first one.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="w-6">
                        <span className="sr-only">Reorder</span>
                      </th>
                      <th className="py-2">Field</th>
                      <th>Key</th>
                      <th>Type</th>
                      <th>Req.</th>
                      <th>Visible to</th>
                      <th>Rule</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((f) => (
                      <tr
                        key={f.id}
                        draggable
                        onDragStart={() => setDragId(f.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => drop(f.id)}
                        className="border-b last:border-0"
                      >
                        <td className="cursor-grab text-muted-foreground" aria-hidden>
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="py-3 font-medium">{f.label}</td>
                        <td>
                          <code className="text-xs">{f.key}</code>
                        </td>
                        <td>
                          {TYPE_LABEL[f.type] ?? f.type}
                          {['SELECT', 'MULTISELECT'].includes(f.type) &&
                            f.options.length > 0 &&
                            ` · ${f.options.length} options`}
                        </td>
                        <td>{f.required ? '✓' : '—'}</td>
                        <td>{VISIBLE[f.visibility]}</td>
                        <td className="max-w-56 text-xs text-muted-foreground">
                          {ruleText(f, fields)}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setField(f)}
                            aria-label={`Edit ${f.label}`}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {action.error ? <ErrorAlert error={action.error} /> : null}
          </Card>
          <Card title="Pack settings">
            <PackForm key={pack.id + pack.name} pack={pack} />
          </Card>
        </div>
      )}
      {pack && (
        <>
          <FieldModal
            group={pack}
            field={field}
            onClose={() => setField(null)}
            onDelete={(f) => {
              setField(null)
              setDel(f)
            }}
          />
          <PreviewModal pack={pack} open={preview} onClose={() => setPreview(false)} />
        </>
      )}
      <ConfirmDialog
        open={del !== null}
        onClose={() => setDel(null)}
        title={`Delete field "${del?.label ?? ''}"?`}
        description="Answers members gave for this field are removed too."
        isLoading={action.isPending}
        onConfirm={() =>
          del &&
          action.mutate(
            { method: 'delete', path: `fields/${del.id}` },
            {
              onSuccess: () => {
                toast({ title: 'Field deleted' })
                setDel(null)
              },
            }
          )
        }
      />
    </div>
  )
}
