'use client'

import { useRouter } from 'next/navigation'
import { Sparkles, Plus, ArrowRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'
import { useTemplateEngineRuns, useCreateRun } from '@/hooks/useTemplateEngine'
import { toast } from '@/hooks/use-toast'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/axios'

interface Project {
  id: string
  name: string
  slug: string
  is_default: boolean
}

export default function StudioLandingPage() {
  return (
    <ModuleGuard slug="template-engine">
      <PermissionGuard permission="template-engine:view">
        <StudioInner />
      </PermissionGuard>
    </ModuleGuard>
  )
}

function StudioInner() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: Project[] }>('/projects')
        .then((r) => r.data.data)
        .catch(() => null),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Studio"
        action={
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Mode A — Active
          </div>
        }
      />

      <p className="text-muted-foreground mb-8">
        Studio guides your brand identity through a 9-stage pipeline — intake, palette extraction,
        AI inference, approval, guidelines, collateral, website assembly, preflight, and export.
      </p>

      {projectsLoading ? (
        <LoadingState />
      ) : projectsError || projects === null ? (
        <NoProjectsModule />
      ) : projects && projects.length > 0 ? (
        <ProjectList
          projects={projects}
          onOpen={(id) => router.push(`/admin/template-engine/projects/${id}`)}
        />
      ) : (
        <EmptyProjectsState />
      )}
    </div>
  )
}

function ProjectList({ projects, onOpen }: { projects: Project[]; onOpen: (id: string) => void }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Projects
      </h2>
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onOpen={() => onOpen(p.id)} />
      ))}
    </div>
  )
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const router = useRouter()
  const { data: runs } = useTemplateEngineRuns(project.id)
  const createRun = useCreateRun()
  const run = runs?.[0]

  const completedCount = run
    ? run.stages.filter((s) => s.status === 'DONE' || s.status === 'SKIPPED').length
    : 0
  const totalStages = 9

  function handleStartRun() {
    createRun.mutate(project.id, {
      onSuccess: () => {
        router.push(`/admin/template-engine/projects/${project.id}/intake`)
      },
      onError: () => {
        toast({
          variant: 'destructive',
          title: 'Failed to start run',
          description: 'Could not create a Studio run. Please try again.',
        })
      },
    })
  }

  return (
    <div className="group flex items-center justify-between rounded-xl border bg-card px-5 py-4 hover:border-primary/40 transition-colors">
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {project.name}
          {project.is_default && (
            <span className="ml-2 text-xs text-muted-foreground">(default)</span>
          )}
        </p>
        {run ? (
          <p className="text-xs text-muted-foreground">
            {completedCount}/{totalStages} stages complete · Run{' '}
            {run.status.toLowerCase().replace('_', ' ')}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No run started</p>
        )}
      </div>
      {run ? (
        <Button size="sm" variant="ghost" onClick={onOpen} className="gap-1.5">
          Open Studio
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          size="sm"
          onClick={handleStartRun}
          disabled={createRun.isPending}
          data-testid={`btn-start-run-${project.id}`}
          className="gap-1.5"
        >
          {createRun.isPending ? 'Starting…' : 'Start run'}
        </Button>
      )}
    </div>
  )
}

function EmptyProjectsState() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">No projects yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Create a project in the projects module to start a Studio run.
      </p>
      <Button size="sm" variant="outline" className="mt-4 gap-2" asChild>
        <a href="/admin/projects">
          <Plus className="h-3.5 w-3.5" />
          Go to Projects
        </a>
      </Button>
    </div>
  )
}

function NoProjectsModule() {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-8 text-center">
      <p className="text-sm font-medium text-muted-foreground">Projects module not available</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The projects module (<code>/api/projects</code>) is required. Enable it to create Studio
        projects.
      </p>
    </div>
  )
}
