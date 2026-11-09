'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, Rocket, XCircle } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { useLaunch, useLaunchCheck, useProjects } from '@/admin/hooks/useProjects'
import { resolveActiveProject, useProjectStore } from '@/stores/project.store'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/admin/components/shared/ConfirmDialog'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/loading-state'

function LaunchInner() {
  const { can } = usePermissions()
  const { data: projects } = useProjects()
  const project = resolveActiveProject(projects, useProjectStore((s) => s.activeProjectId))
  const check = useLaunchCheck(project?.id)
  const launch = useLaunch()
  const [confirm, setConfirm] = useState(false)
  const canLaunch = can('projects:update') && can('page-builder:publish')

  if (!project || check.isLoading) return <LoadingState />
  if (check.error) return <ErrorAlert error={check.error} />
  const report = check.data!
  const blocked = report.pages.filter((p) => !p.can_publish)
  const run = (force: boolean) =>
    launch.mutate(
      { id: project.id, force },
      {
        onSuccess: (r) => toast({ title: `Launched: ${r.published} page${r.published === 1 ? '' : 's'} published` }),
        onSettled: () => setConfirm(false),
      }
    )

  return (
    <>
      <PageHeader title="Launch" />
      <p className="mb-2 max-w-2xl text-sm text-muted-foreground">
        Launch checks every page that is not live yet (drafts, and pages with unpublished edits) and
        publishes them together for <b>{project.name}</b>.
      </p>
      {report.launch && (
        <p className="mb-4 text-sm" data-testid="last-launch">
          Last launched {new Date(report.launch.at).toLocaleString()} · {report.launch.published} pages published
        </p>
      )}
      <ErrorAlert error={launch.error} className="mb-4" />
      {report.pages.length === 0 ? (
        <p className="mb-4 flex items-center gap-2 text-sm" data-testid="nothing-to-launch">
          <CheckCircle2 className="h-4 w-4 text-primary" /> Every page is already live.
        </p>
      ) : (
        <ul className="mb-4 grid max-w-3xl gap-2" data-testid="launch-pages">
          {report.pages.map((p) => (
            <li key={p.id} className="rounded-lg border bg-card p-3 text-sm">
              <div className="flex items-center gap-2">
                {p.can_publish ? (
                  p.warnings ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <b>{p.title}</b>
                <span className="text-xs text-muted-foreground">/{p.slug} · {p.status === 'PUBLISHED' ? 'has edits' : 'draft'}</span>
              </div>
              {p.issues.length > 0 && (
                <ul className="mt-1 list-disc pl-9 text-xs text-muted-foreground">
                  {p.issues.map((i, n) => (
                    <li key={n}>{i.message}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {canLaunch && report.pages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!report.ready || launch.isPending} onClick={() => setConfirm(true)} data-testid="launch-button">
            <Rocket className="mr-2 h-4 w-4" />
            Launch {report.pages.length} page{report.pages.length === 1 ? '' : 's'}
          </Button>
          {!report.ready && (
            <Button variant="outline" disabled={launch.isPending} onClick={() => run(true)}>
              Launch anyway ({blocked.length} with problems)
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        isLoading={launch.isPending}
        title="Launch this project?"
        description={`${report.pages.length} page(s) will go live.`}
        confirmLabel="Launch"
        onConfirm={() => run(false)}
      />
    </>
  )
}

export default function LaunchPage() {
  return (
    <PermissionGuard permission="projects:view">
      <LaunchInner />
    </PermissionGuard>
  )
}
