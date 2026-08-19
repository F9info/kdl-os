'use client'

import { useParams } from 'next/navigation'
import { useTemplateEngineRuns } from '@/hooks/useTemplateEngine'
import { StudioStepper } from '../../_components/StudioStepper'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Sparkles } from 'lucide-react'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ projectId: string; stageSlug?: string }>()
  const projectId = params.projectId
  const activeSlug = params.stageSlug ?? ''

  const { data: runs, isLoading } = useTemplateEngineRuns(projectId)
  const run = runs?.[0] ?? null

  return (
    <div className="flex h-full gap-0">
      {/* Stepper sidebar */}
      <aside
        className="w-56 shrink-0 border-r bg-background/50 px-2 py-4 hidden md:block"
        aria-label="Studio stage navigation"
      >
        <div className="mb-4 flex items-center gap-2 px-3">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </div>

        {isLoading ? (
          <div className="px-3">
            <LoadingSpinner />
          </div>
        ) : run ? (
          <StudioStepper run={run} projectId={projectId} activeSlug={activeSlug} />
        ) : (
          <div className="px-3 text-xs text-muted-foreground">
            No active run. Start a run from the Studio landing page.
          </div>
        )}
      </aside>

      {/* Stage content */}
      <main id="main-content" className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
