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
    <div className="flex h-full flex-col">
      {/* Stepper top bar */}
      <div
        className="shrink-0 border-b bg-background/50 px-4 py-3"
        aria-label="Studio stage navigation"
      >
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Studio
          </span>
        </div>

        {isLoading ? (
          <LoadingSpinner />
        ) : run ? (
          <StudioStepper run={run} projectId={projectId} activeSlug={activeSlug} />
        ) : (
          <div className="text-xs text-muted-foreground">
            No active run. Start a run from the Studio landing page.
          </div>
        )}
      </div>

      {/* Stage content */}
      <main id="main-content" className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}
