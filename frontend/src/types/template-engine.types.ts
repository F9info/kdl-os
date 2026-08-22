export type RunStatus = 'IN_PROGRESS' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED'
export type StageStatus = 'PENDING' | 'RUNNING' | 'AWAITING_INPUT' | 'DONE' | 'FAILED' | 'SKIPPED'
export type DagStage =
  | 'INTAKE'
  | 'PALETTE'
  | 'INFERENCE'
  | 'APPROVAL'
  | 'GUIDELINES'
  | 'COLLATERAL'
  | 'WEBSITE'
  | 'PREFLIGHT'
  | 'EXPORT'

export type StepDisplayState = 'locked' | 'available' | 'in_progress' | 'needs_attention' | 'done'

export interface TemplateEngineStage {
  id: string
  runId: string
  stage: DagStage
  status: StageStatus
  errorCode: string | null
  outputRef: Record<string, unknown> | null
  startedAt: string | null
  completedAt: string | null
}

export interface TemplateEngineRun {
  id: string
  projectId: string
  status: RunStatus
  brandKitVersion: number | null
  createdBy: string
  createdAt: string
  updatedAt: string
  stages: TemplateEngineStage[]
}

// Mirrors backend getExportManifest: guidelines/collateral are the raw stage
// outputRefs and are null when the stage was skipped or wrote no output.
export interface ExportManifest {
  runId: string
  projectId: string
  brandKitVersion: number | null
  site: { themeEndpoint: string; pageIds: string[] }
  guidelines: { renderId?: string; fileUrl?: string; bytes?: number; renderedAt?: string } | null
  collateral: { renderIds?: string[]; skipped?: string } | null
  exportedAt: string
}

export interface StageGateError {
  code:
    | 'STAGE_GATE_FAILED'
    | 'INSUFFICIENT_CREDITS'
    | 'STAGE_NOT_FAILED'
    | 'STAGE_NOT_SKIPPABLE'
    | 'EXPORT_ALREADY_DONE'
    | string
  reason: string
}

export const DAG_STAGES: { slug: string; label: string; stage: DagStage }[] = [
  { slug: 'intake', label: 'Intake', stage: 'INTAKE' },
  { slug: 'palette', label: 'Palette', stage: 'PALETTE' },
  { slug: 'inference', label: 'Brand Inference', stage: 'INFERENCE' },
  { slug: 'approval', label: 'Brand Approval', stage: 'APPROVAL' },
  { slug: 'guidelines', label: 'Brand Guidelines', stage: 'GUIDELINES' },
  { slug: 'collateral', label: 'Collateral', stage: 'COLLATERAL' },
  { slug: 'website', label: 'Website Assembly', stage: 'WEBSITE' },
  { slug: 'preflight', label: 'Preflight', stage: 'PREFLIGHT' },
  { slug: 'export', label: 'Export', stage: 'EXPORT' },
]

export interface BrandKit {
  logo_media_id: string | null
}

export function stageSlugToEnum(slug: string): DagStage | null {
  return DAG_STAGES.find((s) => s.slug === slug)?.stage ?? null
}

export function stageEnumToSlug(stage: DagStage): string {
  return DAG_STAGES.find((s) => s.stage === stage)?.slug ?? stage.toLowerCase()
}

export function stageStatusToDisplay(status: StageStatus, gateBlocked: boolean): StepDisplayState {
  if (status === 'DONE' || status === 'SKIPPED') return 'done'
  if (status === 'RUNNING') return 'in_progress'
  if (status === 'AWAITING_INPUT' || status === 'FAILED') return 'needs_attention'
  if (gateBlocked) return 'locked'
  return 'available'
}
