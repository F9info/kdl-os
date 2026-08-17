'use client'

import { Sparkles, Lock, Eye, Palette } from 'lucide-react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PageHeader } from '@/components/layout/PageHeader'
import { useModules } from '@/hooks/useModules'

/**
 * Template Engine — Phase 0 stub admin screen.
 *
 * Serves as the browser gate proof for the mode switch:
 *  - Enabling this module hides Theme Engine + Page Builder from nav (conflictsWith)
 *  - Theme Engine settings screen goes read-only + badge (locked_by)
 *  - Disabling restores both nav entries and full editability
 *
 * The real Template Engine brand-kit / collateral / DAG logic ships in later phases.
 */
export default function TemplateEnginePage() {
  return (
    <ModuleGuard slug="template-engine">
      <TemplateEngineInner />
    </ModuleGuard>
  )
}

function TemplateEngineInner() {
  const { isEnabled } = useModules()

  const themeEngineUiEnabled = isEnabled('theme-engine-ui')
  const pageBuilderUiEnabled = isEnabled('page-builder-ui')

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Template Engine"
        action={
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Studio Mode — Active
          </div>
        }
      />

      <p className="text-muted-foreground mb-8">
        Template Engine is the brand-identity-to-website generator. While active it owns the theming
        and page-builder engines — direct editing of those screens is suspended.
      </p>

      {/* Mode status card */}
      <div className="rounded-xl border bg-card p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">Mode Status</h2>
        <div className="space-y-3">
          <StatusRow
            icon={<Lock className="h-4 w-4" />}
            label="Theme Engine UI"
            status={themeEngineUiEnabled ? 'conflict-hidden' : 'hidden'}
            note={
              themeEngineUiEnabled
                ? 'Conflict active — should be hidden from nav'
                : 'Hidden from nav — managed by Template Engine'
            }
          />
          <StatusRow
            icon={<Eye className="h-4 w-4" />}
            label="Page Builder UI"
            status={pageBuilderUiEnabled ? 'conflict-hidden' : 'hidden'}
            note={
              pageBuilderUiEnabled
                ? 'Conflict active — should be hidden from nav'
                : 'Hidden from nav — managed by Template Engine'
            }
          />
          <StatusRow
            icon={<Palette className="h-4 w-4" />}
            label="Theme Engine (core)"
            status="running"
            note="Engine always on — Template Engine drives it via /api/theme-engine"
          />
        </div>
      </div>

      {/* Phase 0 notice */}
      <div className="rounded-xl border border-dashed bg-muted/30 p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Phase 0 stub — proving the platform layer</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The full brand-kit, collateral generation, and 9-stage DAG orchestration ship in later
              phases. This stub screen exists to confirm the conflict and locked_by mechanics are
              wired correctly: enabling Template Engine hides the two admin UIs and locks Theme
              Engine settings; disabling it restores them non-destructively.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusRow({
  icon,
  label,
  status,
  note,
}: {
  icon: React.ReactNode
  label: string
  status: 'running' | 'hidden' | 'conflict-hidden'
  note: string
}) {
  const badge = {
    running: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
    hidden: 'bg-muted text-muted-foreground',
    'conflict-hidden': 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  }[status]

  const label2 = {
    running: 'Running',
    hidden: 'Hidden',
    'conflict-hidden': 'Conflict',
  }[status]

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge}`}>{label2}</span>
      <span className="text-xs text-muted-foreground hidden sm:block max-w-xs text-right">
        {note}
      </span>
    </div>
  )
}
