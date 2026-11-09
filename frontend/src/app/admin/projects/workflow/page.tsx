'use client'

import Link from 'next/link'
import { CheckCircle2, Circle, ExternalLink } from 'lucide-react'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useProjects, useSetWorkflowStep } from '@/admin/hooks/useProjects'
import { resolveActiveProject, useProjectStore } from '@/stores/project.store'
import { readWorkflow, workflowProgress, WORKFLOW_STEPS } from '@/admin/lib/project-workflow'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'

function WorkflowInner() {
  const { can } = usePermissions()
  const { data: projects, isLoading, error } = useProjects()
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const tick = useSetWorkflowStep()
  const project = resolveActiveProject(projects, activeProjectId)
  const canEdit = can('projects:update')

  if (isLoading) return <LoadingState />
  if (!project) return <ErrorAlert error={error ?? new Error('Pick a project first.')} />

  const state = readWorkflow(project.config)
  const { done, total, next } = workflowProgress(state)

  return (
    <>
      <PageHeader title="Guided setup" />
      <p className="mb-2 max-w-2xl text-sm text-muted-foreground">
        Build <b>{project.name}</b> step by step. Each step opens the screen where the work is done;
        tick it here when you are happy. Your progress is saved for this project.
      </p>
      <p className="mb-6 text-sm font-medium" data-testid="workflow-progress">
        {done} of {total} steps done
        {next ? ` · next: ${next.title}` : ' · all done'}
      </p>
      <ErrorAlert error={tick.error} className="mb-4" />
      <ol className="grid max-w-3xl gap-3" data-testid="workflow-steps">
        {WORKFLOW_STEPS.map((s, i) => {
          const isDone = !!state[s.key]
          return (
            <li
              key={s.key}
              data-testid={`workflow-step-${s.key}`}
              className={`flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 ${
                next?.key === s.key ? 'border-primary' : ''
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-5 w-5 text-primary" aria-label="Done" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" aria-label="Not done" />
              )}
              <div className="min-w-0 flex-1">
                <b className="text-sm">
                  {i + 1}. {s.title}
                </b>
                <p className="text-xs text-muted-foreground">{s.help}</p>
              </div>
              <Button size="sm" asChild>
                <Link href={s.href(project.id)}>
                  <ExternalLink className="mr-2 h-3.5 w-3.5" />
                  {s.cta}
                </Link>
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={tick.isPending}
                  onClick={() => tick.mutate({ id: project.id, step: s.key, done: !isDone })}
                >
                  {isDone ? 'Mark not done' : 'Mark done'}
                </Button>
              )}
            </li>
          )
        })}
      </ol>
    </>
  )
}

export default function WorkflowPage() {
  return (
    <PermissionGuard permission="projects:view">
      <WorkflowInner />
    </PermissionGuard>
  )
}
