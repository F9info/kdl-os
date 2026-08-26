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
  { slug: 'intake', label: 'Overview', stage: 'INTAKE' },
  { slug: 'palette', label: 'Color Palette', stage: 'PALETTE' },
  { slug: 'inference', label: 'Brand Inference', stage: 'INFERENCE' },
  { slug: 'approval', label: 'Brand Approval', stage: 'APPROVAL' },
  { slug: 'guidelines', label: 'Brand Guidelines', stage: 'GUIDELINES' },
  { slug: 'collateral', label: 'Collateral', stage: 'COLLATERAL' },
  { slug: 'website', label: 'Brands', stage: 'WEBSITE' },
  { slug: 'preflight', label: 'Preflight', stage: 'PREFLIGHT' },
  { slug: 'export', label: 'Export', stage: 'EXPORT' },
]

export interface ContrastAdjustment {
  id: string
  original: string
  derived: string
  tokenName: string
  surface: string
  surfaceName: string
  ratio: number
  reason: string
}

export interface PaletteColor {
  hex: string
  oklch: [number, number, number]
  confidence: number
  ramp: Record<string, string>
  anchorStep: string
}

export type PaletteRole = 'primary' | 'secondary' | 'accent' | 'neutral'

export interface BrandKitPalette {
  schemaVersion: number
  colors: Record<PaletteRole, PaletteColor | null>
  paletteConfidence: 'high' | 'medium' | 'low'
}

// Backend brand-kit/tokens.js only ever reads typography.heading.family /
// .body.family / .scaleRatio as single values, so `family` (the live CSS
// token) is always the first entry of `families` — the full multi-select
// list the Studio UI lets you pick, kept for reference/future use.
export interface TypographyRole {
  family: string
  families?: string[]
}
export interface BrandKitTypography {
  heading: TypographyRole | null
  body: TypographyRole | null
  scaleRatio?: number
}

export interface BrandKit {
  id: string
  project_id: string
  status: 'draft' | 'extracted' | 'inferred' | 'approved'
  logo_media_id: string | null
  logo_raster_media_id: string | null
  // Backend colors.{primary,secondary,accent,neutral} can each be null
  // (e.g. a single-color logo — see palette.test.js fixtures); primary/accent
  // /secondary/neutral are NOT "Tertiary/Quaternary", those are display-only
  // UI labels PaletteStage no longer uses (KDL-558 row 2).
  palette: BrandKitPalette | null
  contrast_report: {
    schemaVersion: number
    allPairsPass: boolean
    adjustments: ContrastAdjustment[]
  } | null
  typography: BrandKitTypography | null
  tone: Record<string, unknown> | null
  approved_at: string | null
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
