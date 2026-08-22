'use client'

import { Building2, Tag, Image, AlertCircle } from 'lucide-react'
import { useAdvanceStage, useBrandKit, useRetryStage } from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function IntakeStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'INTAKE')
  const advance = useAdvanceStage(run.id)
  const retry = useRetryStage(run.id)
  const { data: brandKit } = useBrandKit(run.projectId)
  const hasLogo = !!brandKit?.logo_media_id

  return (
    <StageShell
      title="Intake"
      description="Provide your brand's foundational details — company name, industry, tagline, and logo. These become the starting point for the entire brand pipeline."
      stage={stage ?? null}
      onRun={
        stage?.status === 'FAILED' ? () => retry.mutate('INTAKE') : () => advance.mutate('INTAKE')
      }
      isRunning={advance.isPending || retry.isPending}
      runDisabled={!hasLogo && stage?.status !== 'FAILED'}
    >
      <div className="grid gap-4 max-w-xl">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Building2 className="h-4 w-4 shrink-0" />
          <span>Company name — collected from brand-kit intake</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Tag className="h-4 w-4 shrink-0" />
          <span>Industry + tagline — used to seed tone inference</span>
        </div>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Image className="h-4 w-4 shrink-0" />
          <span>Logo upload — required for palette extraction (stage 2)</span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Intake data is managed via the brand-kit module. Running this stage sends the project to
          the brand-kit intake endpoint and records the kit version.
        </p>
        {!hasLogo && (
          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Upload a logo to continue.
          </div>
        )}
      </div>
    </StageShell>
  )
}
