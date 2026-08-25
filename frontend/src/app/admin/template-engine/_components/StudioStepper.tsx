'use client'

import { useRouter } from 'next/navigation'
import { Check, AlertCircle, Lock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  DAG_STAGES,
  stageStatusToDisplay,
  type TemplateEngineRun,
  type StepDisplayState,
} from '@/types/template-engine.types'

interface StudioStepperProps {
  run: TemplateEngineRun
  projectId: string
  activeSlug: string
}

export function StudioStepper({ run, projectId, activeSlug }: StudioStepperProps) {
  const router = useRouter()

  const stageMap = Object.fromEntries(run.stages.map((s) => [s.stage, s]))

  return (
    <nav aria-label="Studio stages" className="flex flex-row gap-1 overflow-x-auto">
      {DAG_STAGES.map((def, idx) => {
        const stageRow = stageMap[def.stage]
        const status = stageRow?.status ?? 'PENDING'

        // Gate: check if any dependency is not DONE or SKIPPED
        const gateBlocked = idx > 0 && !isGateOpen(run, def.stage)
        const displayState = stageStatusToDisplay(status, gateBlocked)
        const isActive = activeSlug === def.slug

        const errorCode = stageRow?.errorCode ?? null

        return (
          <StepItem
            key={def.slug}
            label={def.label}
            index={idx + 1}
            displayState={displayState}
            isActive={isActive}
            errorCode={errorCode}
            onClick={
              displayState !== 'locked'
                ? () => router.push(`/admin/template-engine/projects/${projectId}/${def.slug}`)
                : undefined
            }
          />
        )
      })}
    </nav>
  )
}

function isGateOpen(run: TemplateEngineRun, stage: string): boolean {
  const stageMap = Object.fromEntries(run.stages.map((s) => [s.stage, s]))
  const done = (s: string) => {
    const row = stageMap[s]
    return row?.status === 'DONE' || row?.status === 'SKIPPED'
  }
  switch (stage) {
    case 'INTAKE':
      return true
    case 'PALETTE':
      return done('INTAKE')
    case 'INFERENCE':
      return done('PALETTE')
    case 'APPROVAL':
      return done('INFERENCE')
    case 'GUIDELINES':
    case 'COLLATERAL':
    case 'WEBSITE':
      return done('APPROVAL')
    case 'PREFLIGHT':
      return done('GUIDELINES') && done('COLLATERAL') && done('WEBSITE')
    case 'EXPORT':
      return done('PREFLIGHT')
    default:
      return false
  }
}

interface StepItemProps {
  label: string
  index: number
  displayState: StepDisplayState
  isActive: boolean
  errorCode: string | null
  onClick?: () => void
}

function StepItem({ label, index, displayState, isActive, errorCode, onClick }: StepItemProps) {
  const icon = stepIcon(displayState)
  const isClickable = !!onClick

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={onClick}
      aria-current={isActive ? 'step' : undefined}
      className={cn(
        'group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors',
        isActive && 'bg-primary/10 text-primary font-medium',
        !isActive && isClickable && 'hover:bg-muted text-foreground',
        !isActive && !isClickable && 'text-muted-foreground cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
          displayState === 'done' &&
            'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
          displayState === 'in_progress' && 'bg-primary/20 text-primary',
          displayState === 'needs_attention' &&
            'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
          displayState === 'locked' && 'bg-muted text-muted-foreground',
          displayState === 'available' && !isActive && 'bg-muted text-muted-foreground',
          displayState === 'available' && isActive && 'bg-primary/20 text-primary'
        )}
        aria-hidden="true"
      >
        {icon ?? index}
      </span>
      <span>{label}</span>
      {displayState === 'needs_attention' && errorCode && (
        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900 dark:text-amber-300">
          {errorCode}
        </span>
      )}
    </button>
  )
}

function stepIcon(displayState: StepDisplayState) {
  switch (displayState) {
    case 'done':
      return <Check className="h-3.5 w-3.5" />
    case 'in_progress':
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />
    case 'needs_attention':
      return <AlertCircle className="h-3.5 w-3.5" />
    case 'locked':
      return <Lock className="h-3 w-3" />
    default:
      return null
  }
}
