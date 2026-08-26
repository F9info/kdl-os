'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Star, ArrowRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

interface Project {
  id: string
  name: string
  slug: string
  is_default: boolean
}

interface ProjectFormState {
  name: string
  slug: string
  is_default: boolean
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function ProjectsPage() {
  return (
    <PermissionGuard permission="projects:view">
      <ProjectsInner />
    </PermissionGuard>
  )
}

function ProjectsInner() {
  const router = useRouter()
  const qc = useQueryClient()

  const [createOpen, setCreateOpen] = useState(false)
  const [editProject, setEditProject] = useState<Project | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState<ProjectFormState>({ name: '', slug: '', is_default: false })
  const [formError, setFormError] = useState<string | null>(null)

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      api.get<{ success: boolean; data: Project[] }>('/projects').then((r) => r.data.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: ProjectFormState) => api.post('/projects', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project created' })
      setCreateOpen(false)
      setForm({ name: '', slug: '', is_default: false })
      setFormError(null)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to create project'
      setFormError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectFormState }) =>
      api.patch(`/projects/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project updated' })
      setEditProject(null)
      setFormError(null)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to update project'
      setFormError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      toast({ title: 'Project deleted' })
      setDeleteId(null)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to delete project'
      toast({ title: msg, variant: 'destructive' })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setForm({ name: '', slug: '', is_default: false })
    setFormError(null)
    setCreateOpen(true)
  }

  function openEdit(p: Project) {
    setForm({ name: p.name, slug: p.slug, is_default: p.is_default })
    setFormError(null)
    setEditProject(p)
  }

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: slugify(name) }))
  }

  return (
    <div>
      <PageHeader
        title="Projects"
        action={
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        }
      />

      <p className="text-muted-foreground mb-6 text-sm">
        Projects are the top-level scope for Studio runs. Each project gets its own brand kit,
        template pipeline, and theme.
      </p>

      {isLoading ? (
        <LoadingState />
      ) : !projects?.length ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium">No projects yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first project to start a Studio run.
          </p>
          <Button size="sm" variant="outline" className="mt-4 gap-2" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            Create project
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-xl border bg-card px-5 py-4"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.name}</span>
                  {p.is_default && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      <Star className="h-3 w-3" />
                      Default
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground font-mono">{p.slug}</p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => router.push(`/admin/template-engine`)}
                >
                  Open Studio
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(p)}
                  aria-label={`Edit ${p.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setDeleteId(p.id)}
                  aria-label={`Delete ${p.name}`}
                  disabled={p.is_default}
                  title={p.is_default ? 'Cannot delete the default project' : undefined}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        open={createOpen}
        onClose={() => {
          setCreateOpen(false)
          setFormError(null)
        }}
        title="New project"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name.trim()}
            >
              {createMutation.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </div>
        }
      >
        <ProjectForm
          form={form}
          onNameChange={handleNameChange}
          onSlugChange={(slug) => setForm((f) => ({ ...f, slug }))}
          onDefaultChange={(is_default) => setForm((f) => ({ ...f, is_default }))}
          error={formError}
        />
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editProject !== null}
        onClose={() => {
          setEditProject(null)
          setFormError(null)
        }}
        title={`Edit — ${editProject?.name ?? ''}`}
        footer={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditProject(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editProject && updateMutation.mutate({ id: editProject.id, data: form })
              }
              disabled={updateMutation.isPending || !form.name.trim()}
            >
              {updateMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        }
      >
        <ProjectForm
          form={form}
          onNameChange={handleNameChange}
          onSlugChange={(slug) => setForm((f) => ({ ...f, slug }))}
          onDefaultChange={(is_default) => setForm((f) => ({ ...f, is_default }))}
          error={formError}
        />
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete project?"
        description="This will soft-delete the project. All associated runs and brand-kit data will become inaccessible."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}

function ProjectForm({
  form,
  onNameChange,
  onSlugChange,
  onDefaultChange,
  error,
}: {
  form: ProjectFormState
  onNameChange: (v: string) => void
  onSlugChange: (v: string) => void
  onDefaultChange: (v: boolean) => void
  error: string | null
}) {
  return (
    <div className="space-y-4">
      <FormField label="Name" required>
        <Input
          value={form.name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="My Brand"
        />
      </FormField>
      <FormField label="Slug" required>
        <Input
          value={form.slug}
          onChange={(e) => onSlugChange(e.target.value)}
          placeholder="my-brand"
          className="font-mono text-sm"
        />
      </FormField>
      <FormField label="Default project">
        <div className="flex items-center gap-2">
          <Switch checked={form.is_default} onCheckedChange={onDefaultChange} />
          <span className="text-sm text-muted-foreground">
            {form.is_default ? 'Yes — sets as the default project' : 'No'}
          </span>
        </div>
      </FormField>
      {error && <ErrorAlert error={new Error(error)} />}
    </div>
  )
}
