import type { ModulePlan } from '@/types/models.types'

/**
 * Shown inside the install / enable / disable confirmation: the dependency chain, what else will be switched
 * on or off, and anything that blocks the action. Everything comes from GET /modules/:slug/plan (the manifests
 * and the live module status), nothing is written here.
 */
export function ModulePlanSummary({
  plan,
  isLoading,
  isError,
}: {
  plan: ModulePlan | undefined
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Checking dependencies…
      </p>
    )
  }
  if (isError || !plan) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Could not check dependencies. The server still enforces them when you continue.
      </p>
    )
  }

  const alsoRun = plan.steps.filter((s) => s.dependency)
  return (
    <div className="space-y-3 text-sm" data-testid="module-plan">
      {plan.blockers.length > 0 && (
        <ul
          role="alert"
          className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive"
        >
          {plan.blockers.map((b) => (
            <li key={`${b.type}:${b.message}`}>{b.message}</li>
          ))}
        </ul>
      )}

      {plan.action !== 'disable' && plan.dependsOn.length > 0 && (
        <div>
          <p className="font-medium text-foreground">Needs</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {plan.dependsOn.map((d) => (
              <li key={d.slug}>
                <span className="text-foreground">{d.name}</span> ({d.group}) ·{' '}
                {d.status.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {alsoRun.length > 0 && (
        <div>
          <p className="font-medium text-foreground">This will also, first:</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">
            {alsoRun.map((s) => (
              <li key={s.slug}>
                {s.do} <span className="text-foreground">{s.name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {plan.conflicts.length > 0 && (
        <p className="text-muted-foreground">
          Switches off:{' '}
          <span className="text-foreground">{plan.conflicts.map((c) => c.name).join(', ')}</span>
        </p>
      )}

      {plan.action === 'disable' && plan.requiredBy.length > 0 && plan.blockers.length === 0 && (
        <p className="text-muted-foreground">
          Used by:{' '}
          <span className="text-foreground">{plan.requiredBy.map((m) => m.name).join(', ')}</span>
        </p>
      )}
    </div>
  )
}
