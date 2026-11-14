'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, Play, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { installApi, type InstallProgress, type InstallState } from './install-api'

/**
 * Installer step 4: core installation. Runs the same ordered seeders as `npm run db:seed` (modules, roles and
 * permissions, default users, brand kit, theme, credits) and creates the admin. Safe to retry: every seeder
 * is idempotent, and once it is done it is never run again.
 */
export function CoreStep({
  core,
  onBack,
  onNext,
}: {
  core: InstallState['core']
  onBack: () => void
  onNext: () => void
}) {
  const qc = useQueryClient()
  const run = useMutation({
    mutationFn: () => installApi.post('/core', undefined, { timeout: 300_000 }),
    onSettled: () => qc.invalidateQueries({ queryKey: ['install'] }),
  })
  const done = core === 'done' || run.isSuccess

  // The log fills in while the run is going (the request itself only returns at the end).
  const { data: progress } = useQuery({
    queryKey: ['install', 'progress'],
    queryFn: () => installApi.get('/progress').then((r) => r.data.data as InstallProgress),
    refetchInterval: run.isPending ? 1200 : false,
    retry: false,
  })
  const lines = (progress?.log ?? []).filter((l) => l.step === 'core').slice(-12)
  const failed = core === 'failed' && !run.isPending

  return (
    <section>
      <h1 className="text-xl font-semibold">Core installation</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">
        This sets up the roles, permissions, default settings and your admin account. It takes a few
        seconds.
      </p>

      <div className="space-y-4">
        {done && (
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-emerald-600">
            <Check className="h-4 w-4" /> Core installation is complete
          </p>
        )}
        {failed && !run.error && (
          <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
            <X className="h-4 w-4" /> The last run stopped. Nothing was lost; run it again.
          </p>
        )}
        {run.error && <ErrorAlert error={run.error} />}
        {lines.length > 0 && (
          <ol
            aria-label="Installation log"
            className="max-h-48 space-y-0.5 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs"
          >
            {lines.map((l, i) => (
              <li key={`${l.at}-${i}`} className={l.level === 'error' ? 'text-destructive' : ''}>
                {l.message}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" onClick={onBack} disabled={run.isPending}>
          Back
        </Button>
        {done ? (
          <Button onClick={onNext}>Next</Button>
        ) : (
          <Button onClick={() => run.mutate()} disabled={run.isPending}>
            {run.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Installing…
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" /> {failed ? 'Try again' : 'Run core installation'}
              </>
            )}
          </Button>
        )}
      </div>
    </section>
  )
}
