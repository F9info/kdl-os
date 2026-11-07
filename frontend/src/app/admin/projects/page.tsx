'use client'

import { useState } from 'react'
import { Archive, ArchiveRestore, CheckCircle2, FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import {
  useDeleteProject,
  useProjects,
  useSetActiveProject,
  useUpdateProject,
  type Project,
} from '@/admin/hooks/useProjects'
import { resolveActiveProject, useProjectStore } from '@/stores/project.store'
import { kindsLabel, STATUS_LABELS } from '@/admin/lib/project-kinds'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { StatusBadge } from '@/admin/components/shared/StatusBadge'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { ProjectDialog } from './ProjectDialog'

const statusVariant = { DRAFT: 'pending', ACTIVE: 'active', ARCHIVED: 'inactive' } as const

function ProjectsPageInner() {
  const { can } = usePermissions()
  const { data: projects, isLoading, error } = useProjects()
  const update = useUpdateProject()
  const remove = useDeleteProject()
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const setActiveProjectId = useSetActiveProject()
  const active = resolveActiveProject(projects, activeProjectId)

  const [dialog, setDialog] = useState<{ open: boolean; project: Project | null }>({
    open: false,
    project: null,
  })
  const [toDelete, setToDelete] = useState<Project | null>(null)

  const canCreate = can('projects:create')
  const canUpdate = can('projects:update')
  const canDelete = can('projects:delete')

  const setStatus = (p: Project, status: 'ACTIVE' | 'ARCHIVED') =>
    update.mutate(
      { id: p.id, status },
      {
        onSuccess: () => {
          // Never keep working in a project that was just archived.
          if (status === 'ARCHIVED' && p.id === activeProjectId) setActiveProjectId(null)
          toast({ title: status === 'ARCHIVED' ? 'Project archived' : 'Project restored' })
        },
      }
    )

  return (
    <>
      <PageHeader
        title="Projects"
        action={
          canCreate && (
            <Button onClick={() => setDialog({ open: true, project: null })} data-testid="new-project">
              <Plus className="h-4 w-4" />
              New project
            </Button>
          )
        }
      />
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        One installation can hold many projects. Each one can combine a website, landing pages and a
        static export. Pick the project you are working in from the switcher at the top.
      </p>

      <ErrorAlert error={error ?? update.error ?? remove.error} className="mb-4" />

      {isLoading ? (
        <LoadingState />
      ) : !projects || projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start building."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="project-list">
          {projects.map((p) => {
            const isActive = active?.id === p.id
            return (
              <li
                key={p.id}
                data-testid={`project-card-${p.slug}`}
                className="flex flex-col gap-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{p.name}</h2>
                    <p className="truncate text-xs text-muted-foreground">{p.slug}</p>
                  </div>
                  <StatusBadge variant={statusVariant[p.status]} label={STATUS_LABELS[p.status]} />
                </div>
                <p className="text-sm">{kindsLabel(p.kinds)}</p>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {p.is_default && <span className="rounded bg-muted px-2 py-0.5">Default</span>}
                  {isActive && (
                    <span className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-primary">
                      <CheckCircle2 className="h-3 w-3" /> Working in this project
                    </span>
                  )}
                </div>
                <div className="mt-auto flex flex-wrap gap-2">
                  {!isActive && p.status !== 'ARCHIVED' && (
                    <Button
                      size="sm"
                      onClick={() => setActiveProjectId(p.id)}
                      data-testid={`work-in-${p.slug}`}
                    >
                      Work in this project
                    </Button>
                  )}
                  {canUpdate && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDialog({ open: true, project: p })}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {canUpdate && !p.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={update.isPending}
                      onClick={() => setStatus(p, p.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED')}
                    >
                      {p.status === 'ARCHIVED' ? (
                        <>
                          <ArchiveRestore className="h-4 w-4" />
                          Restore
                        </>
                      ) : (
                        <>
                          <Archive className="h-4 w-4" />
                          Archive
                        </>
                      )}
                    </Button>
                  )}
                  {canDelete && !p.is_default && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setToDelete(p)}
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ProjectDialog
        open={dialog.open}
        project={dialog.project}
        onClose={() => setDialog({ open: false, project: null })}
      />
      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        title="Delete project"
        description={`Delete "${toDelete?.name ?? ''}"? It is hidden from every list. This does not remove its files from disk.`}
        isLoading={remove.isPending}
        onConfirm={() => {
          if (!toDelete) return
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              if (toDelete.id === activeProjectId) setActiveProjectId(null)
              toast({ title: 'Project deleted' })
              setToDelete(null)
            },
          })
        }}
      />
    </>
  )
}

export default function ProjectsPage() {
  return (
    <PermissionGuard permission="projects:view">
      <ProjectsPageInner />
    </PermissionGuard>
  )
}
