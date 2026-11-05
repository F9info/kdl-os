'use client'

import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Inbox, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import {
  useDeleteForm,
  useForms,
  useFormSubmissions,
  useSaveForm,
  type FormDef,
} from '@/admin/hooks/useForms'
import { slugify } from '@/lib/utils'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { formSchema, withKeys, type FormValues } from './_schemas'

const NEW_FORM: FormValues = {
  name: '',
  slug: '',
  fields: [
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true },
    { key: 'message', label: 'Message', type: 'textarea', required: false },
  ],
  submit_label: 'Send',
  success_message: 'Thank you. We will be in touch.',
  notify_email: '',
  is_active: true,
}

const selectClass =
  'h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function FormDialog({ form, onClose }: { form: FormDef | 'new'; onClose: () => void }) {
  const editing = form === 'new' ? null : form
  const save = useSaveForm()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: editing ? { ...editing, notify_email: editing.notify_email ?? '' } : NEW_FORM,
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'fields' })

  const onSubmit = (values: FormValues) =>
    save.mutate(
      {
        id: editing?.id,
        // The slug is the public key used by page blocks, so it is fixed after creation.
        input: {
          ...values,
          fields: withKeys(values.fields),
          ...(editing ? { slug: undefined } : {}),
        },
      },
      {
        onSuccess: () => {
          toast({ title: editing ? 'Form saved' : 'Form created' })
          onClose()
        },
      }
    )

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={editing ? 'Edit form' : 'New form'}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={save.isPending}>
            {editing ? 'Save changes' : 'Create form'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" error={errors.name?.message} required>
            <Input
              placeholder="e.g. Contact us"
              {...register('name', {
                onChange: (e) => {
                  if (!editing && !dirtyFields.slug) setValue('slug', slugify(e.target.value))
                },
              })}
            />
          </FormField>
          <FormField
            label="Slug"
            error={errors.slug?.message}
            hint={editing ? 'Fixed after creation.' : 'Used by the Contact form block.'}
            required
          >
            <Input disabled={Boolean(editing)} {...register('slug')} />
          </FormField>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Fields</legend>
          {fields.map((field, i) => (
            <div key={field.id} className="flex flex-wrap items-start gap-2">
              <div className="min-w-40 flex-1">
                <Input
                  aria-label={`Field ${i + 1} label`}
                  placeholder="Label"
                  {...register(`fields.${i}.label`)}
                />
                {errors.fields?.[i]?.label && (
                  <p className="mt-1 text-xs text-destructive">
                    {errors.fields[i]?.label?.message}
                  </p>
                )}
              </div>
              <select
                aria-label={`Field ${i + 1} type`}
                className={selectClass}
                {...register(`fields.${i}.type`)}
              >
                <option value="text">Text</option>
                <option value="email">Email</option>
                <option value="tel">Phone</option>
                <option value="textarea">Long text</option>
              </select>
              <label className="flex h-10 items-center gap-1 text-sm">
                <input type="checkbox" {...register(`fields.${i}.required`)} />
                Required
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove field ${i + 1}`}
                disabled={fields.length === 1}
                onClick={() => remove(i)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {errors.fields?.message && (
            <p className="text-xs text-destructive">{errors.fields.message}</p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={fields.length >= 20}
            onClick={() => append({ key: '', label: '', type: 'text', required: false })}
          >
            <Plus className="h-4 w-4" />
            Add field
          </Button>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Button text" error={errors.submit_label?.message} required>
            <Input {...register('submit_label')} />
          </FormField>
          <FormField
            label="Email new submissions to"
            error={errors.notify_email?.message}
            hint="Leave empty to only store them here."
          >
            <Input type="email" {...register('notify_email')} />
          </FormField>
        </div>
        <FormField label="Thank-you message" error={errors.success_message?.message} required>
          <Input {...register('success_message')} />
        </FormField>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" {...register('is_active')} />
          Accepting submissions{watch('is_active') ? '' : ' (off: the form is hidden on the site)'}
        </label>
        {save.error && <ErrorAlert error={save.error} />}
      </form>
    </Modal>
  )
}

function SubmissionsDialog({ form, onClose }: { form: FormDef; onClose: () => void }) {
  const { data, isLoading, error } = useFormSubmissions(form.id)
  return (
    <Modal open onClose={onClose} size="lg" title={`Submissions: ${form.name}`}>
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : !data?.length ? (
        <EmptyState icon={Inbox} title="No submissions yet" />
      ) : (
        <ul className="space-y-3">
          {data.map((s) => (
            <li key={s.id} className="rounded-md border p-3 text-sm">
              <p className="mb-2 text-xs text-muted-foreground">
                {new Date(s.created_at).toLocaleString()}
              </p>
              <dl className="grid gap-1 sm:grid-cols-[10rem_1fr]">
                {form.fields
                  .filter((f) => s.data[f.key] !== undefined)
                  .map((f) => (
                    <div key={f.key} className="contents">
                      <dt className="font-medium">{f.label}</dt>
                      <dd className="whitespace-pre-wrap break-words">{s.data[f.key]}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

function FormsContent() {
  const { can } = usePermissions()
  const { data: forms, isLoading, error } = useForms()
  const remove = useDeleteForm()
  const [editing, setEditing] = useState<FormDef | 'new' | null>(null)
  const [viewing, setViewing] = useState<FormDef | null>(null)
  const [deleting, setDeleting] = useState<FormDef | null>(null)

  return (
    <div>
      <PageHeader
        title="Forms"
        breadcrumbs={[{ label: 'Forms' }]}
        action={
          can('forms:add') ? (
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" />
              New form
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorAlert error={error} />
      ) : !forms?.length ? (
        <EmptyState
          icon={FileText}
          title="No forms yet"
          description="Create a form, then add the Contact form block to a page."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {forms.map((f) => (
            <li key={f.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{f.name}</h3>
                  <p className="truncate text-sm text-muted-foreground">
                    {f.slug} · {f.fields.length} fields
                  </p>
                </div>
                <StatusBadge variant={f.is_active ? 'active' : 'inactive'} />
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setViewing(f)}>
                  <Inbox className="h-4 w-4" />
                  Submissions ({f._count?.submissions ?? 0})
                </Button>
                {can('forms:edit') && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(f)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
                {can('forms:delete') && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    aria-label={`Delete ${f.name}`}
                    onClick={() => setDeleting(f)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing && <FormDialog form={editing} onClose={() => setEditing(null)} />}
      {viewing && <SubmissionsDialog form={viewing} onClose={() => setViewing(null)} />}
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast({ title: 'Form deleted' })
              setDeleting(null)
            },
          })
        }
        title="Delete form?"
        description="The form stops accepting submissions. Existing submissions are kept."
        isLoading={remove.isPending}
      />
    </div>
  )
}

export default function FormsPage() {
  return (
    <ModuleGuard slug="forms">
      <PermissionGuard permission="forms:view">
        <FormsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
