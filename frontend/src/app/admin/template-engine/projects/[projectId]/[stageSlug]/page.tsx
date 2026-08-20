'use client'

import { useParams, useRouter } from 'next/navigation'
import { useTemplateEngineRuns, useCreateRun } from '@/hooks/useTemplateEngine'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { IntakeStage } from '../../../_components/stages/IntakeStage'
import { PaletteStage } from '../../../_components/stages/PaletteStage'
import { InferenceStage } from '../../../_components/stages/InferenceStage'
import { ApprovalStage } from '../../../_components/stages/ApprovalStage'
import { GuidelinesStage } from '../../../_components/stages/GuidelinesStage'
import { CollateralStage } from '../../../_components/stages/CollateralStage'
import { WebsiteStage } from '../../../_components/stages/WebsiteStage'
import { PreflightStage } from '../../../_components/stages/PreflightStage'
import { ExportStage } from '../../../_components/stages/ExportStage'
import type { TemplateEngineRun } from '@/types/template-engine.types'

const STAGE_COMPONENTS: Record<string, React.ComponentType<{ run: TemplateEngineRun }>> = {
  intake: IntakeStage,
  palette: PaletteStage,
  inference: InferenceStage,
  approval: ApprovalStage,
  guidelines: GuidelinesStage,
  collateral: CollateralStage,
  website: WebsiteStage,
  preflight: PreflightStage,
  export: ExportStage,
}

export default function StagePage() {
  const { projectId, stageSlug } = useParams<{ projectId: string; stageSlug: string }>()
  const { data: runs, isLoading, isError } = useTemplateEngineRuns(projectId)

  if (isLoading) {
    return <LoadingSpinner fullPage />
  }

  if (isError) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Could not load run data. The orchestrator backend may not be available yet.
      </div>
    )
  }

  const run = runs?.[0]

  if (!run) {
    return <NoRunPlaceholder stageSlug={stageSlug} projectId={projectId} />
  }

  const StageComponent = STAGE_COMPONENTS[stageSlug]

  if (!StageComponent) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Unknown stage: <code className="ml-1">{stageSlug}</code>
      </div>
    )
  }

  return <StageComponent run={run} />
}

function NoRunPlaceholder({ stageSlug, projectId }: { stageSlug: string; projectId: string }) {
  const router = useRouter()
  const createRun = useCreateRun()

  function handleStart() {
    createRun.mutate(projectId, {
      onSuccess: () => {
        // Invalidation triggers a re-fetch; navigate to intake so the run is found
        router.push(`/admin/template-engine/projects/${projectId}/intake`)
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
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm font-medium">No Studio run exists for this project yet.</p>
      <p className="text-xs text-muted-foreground max-w-xs">
        Start a run to begin the {stageSlug} stage.
      </p>
      <Button
        size="sm"
        onClick={handleStart}
        disabled={createRun.isPending}
        data-testid="btn-start-run"
      >
        {createRun.isPending ? 'Starting…' : 'Start Studio run'}
      </Button>
    </div>
  )
}
