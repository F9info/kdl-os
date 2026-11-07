'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from '@/hooks/use-toast'
import { slugify } from '@/lib/utils'
import { useCreateProject, useUpdateProject, type Project } from '@/admin/hooks/useProjects'
import {
  KIND_HINTS,
  KIND_LABELS,
  OPTIONAL_KINDS,
  PROJECT_STATUSES,
  STATUS_LABELS,
} from '@/admin/lib/project-kinds'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { FormField } from '@/components/shared/FormField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { projectFormSchema, type ProjectForm } from './_schemas'

const EMPTY: ProjectForm = { name: '', slug: '', kinds: ['WEBSITE'], status: 'DRAFT' }

/** Create a project, or edit one when `project` is given. */
export function ProjectDialog({
  open,
  project,
  onClose,
}: {
  open: boolean
  project: Project | null
  onClose: () => void
}) {
  const create = useCreateProject()
  const update = useUpdateProject()
  const mutation = project ? update : create
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, dirtyFields },
  } = useForm<ProjectForm>({ resolver: zodResolver(projectFormSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    reset(
      project
        ? {
            name: project.name,
            slug: project.slug,
            kinds: project.kinds.filter((k): k is (typeof OPTIONAL_KINDS)[number] =>
              (OPTIONAL_KINDS as readonly string[]).includes(k)
            ),
            status: project.status,
          }
        : EMPTY
    )
  }, [open, project, reset])

  const close = () => {
    create.reset()
    update.reset()
    onClose()
  }

  const onSubmit = (form: ProjectForm) => {
    const done = (title: string) => () => {
      toast({ title })
      close()
    }
    if (project) update.mutate({ id: project.id, ...form }, { onSuccess: done('Project saved') })
    else create.mutate(form, { onSuccess: done('Project created') })
  }

  const kinds = watch('kinds')

  return (
    <Modal
      open={open}
      onClose={close}
      title={project ? 'Edit project' : 'New project'}
      description="A project is one thing you build and manage. It can combine a website, landing pages and a static export."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit(onSubmit)}
            disabled={mutation.isPending}
            data-testid="project-save"
          >
            {project ? 'Save' : 'Create project'}
          </Button>
        </div>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        <ErrorAlert error={mutation.error} />
        <FormField label="Name" error={errors.name?.message} required>
          <Input
            placeholder="e.g. Subhadra Group"
            {...register('name', {
              // The slug follows the name until the person edits it, and never changes on an existing project.
              onChange: (e) => {
                if (!project && !dirtyFields.slug) setValue('slug', slugify(e.target.value))
              },
            })}
          />
        </FormField>
        <FormField label="Slug" error={errors.slug?.message} hint="Used in addresses and folder names." required>
          <Input {...register('slug')} />
        </FormField>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">What does this project include?</legend>
          <p className="text-sm text-muted-foreground">
            The admin panel is always included. Switch on what else you need.
          </p>
          {OPTIONAL_KINDS.map((k) => (
            <label
              key={k}
              className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm"
            >
              <input
                type="checkbox"
                value={k}
                className="mt-1"
                data-testid={`kind-${k}`}
                {...register('kinds')}
              />
              <span>
                <span className="block font-medium">{KIND_LABELS[k]}</span>
                <span className="text-muted-foreground">{KIND_HINTS[k]}</span>
              </span>
            </label>
          ))}
          <p className="sr-only" aria-live="polite">
            {kinds.length} extra parts selected
          </p>
        </fieldset>

        <FormField label="Status" error={errors.status?.message}>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            {...register('status')}
          >
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </FormField>
      </form>
    </Modal>
  )
}
