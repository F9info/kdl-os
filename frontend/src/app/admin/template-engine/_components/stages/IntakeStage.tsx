'use client'

import { useRef } from 'react'
import { Building2, Tag, Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import {
  useAdvanceStage,
  useBrandKit,
  useRetryStage,
  useUploadLogo,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { Button } from '@/components/ui/button'
import type { TemplateEngineRun } from '@/types/template-engine.types'

export function IntakeStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'INTAKE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(run.projectId)
  const uploadLogo = useUploadLogo(run.projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasLogo = !!brandKit?.logo_media_id

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadLogo.mutate(file)
    // Reset so the same file can be re-selected if needed
    e.target.value = ''
  }

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

        {/* Logo upload */}
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              {kitLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : hasLogo ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
              <span>Logo</span>
              {hasLogo && (
                <span className="text-xs font-normal text-muted-foreground">(uploaded)</span>
              )}
            </div>
            <Button
              size="sm"
              variant={hasLogo ? 'outline' : 'default'}
              className="gap-2"
              disabled={uploadLogo.isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadLogo.isPending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload className="h-3.5 w-3.5" />
                  {hasLogo ? 'Replace logo' : 'Upload logo'}
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/svg+xml,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            SVG, PNG, JPEG or WebP · max 5 MB. Required for palette extraction (stage 2).
          </p>
          {!hasLogo && !kitLoading && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Upload a logo to enable &ldquo;Run stage&rdquo;.
            </div>
          )}
        </div>
      </div>
    </StageShell>
  )
}
