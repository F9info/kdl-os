'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import {
  useAdvanceStage,
  useBrandKit,
  useBrandContactFields,
  useSaveBrandContactFields,
  useRetryStage,
  useUploadLogo,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TemplateEngineRun } from '@/types/template-engine.types'

// Two-column layout order matching the prototype's "Logo & Contact Details"
// screen (templateEngine 2.html Overview stage). Fields not paired here
// (secondary_phone, address1, address2) render full-width below.
const PAIRED_ROWS: Array<[string, string]> = [
  ['company_name', 'primary_email'],
  ['secondary_email', 'primary_phone'],
]
const FULL_WIDTH_KEYS = ['secondary_phone', 'address1', 'address2']

export function IntakeStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'INTAKE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(run.projectId)
  const uploadLogo = useUploadLogo(run.projectId)
  const { data: contactFields } = useBrandContactFields(run.projectId)
  const saveContact = useSaveBrandContactFields(run.projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [values, setValues] = useState<Record<string, string>>({})

  // Seed local edit state once the saved values load; don't clobber in-progress edits on refetch.
  useEffect(() => {
    if (!contactFields) return
    setValues((prev) =>
      Object.keys(prev).length > 0
        ? prev
        : Object.fromEntries(contactFields.map((f) => [f.key, f.value]))
    )
  }, [contactFields])

  const byKey = Object.fromEntries((contactFields ?? []).map((f) => [f.key, f]))
  const hasLogo = !!brandKit?.logo_media_id

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadLogo.mutate(file)
    // Reset so the same file can be re-selected if needed
    e.target.value = ''
  }

  function field(key: string) {
    return (
      <div key={key}>
        <Label htmlFor={`intake-${key}`}>
          {byKey[key]?.label ?? key}
          {key === 'company_name' && <span className="text-destructive"> *</span>}
        </Label>
        <Input
          id={`intake-${key}`}
          value={values[key] ?? ''}
          placeholder="Type a value…"
          onChange={(e) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
        />
      </div>
    )
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
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <h3 className="text-sm font-medium">Logo &amp; Contact Details</h3>
          {PAIRED_ROWS.map(([left, right]) => (
            <div key={left} className="grid grid-cols-2 gap-4">
              {field(left)}
              {field(right)}
            </div>
          ))}
          {FULL_WIDTH_KEYS.map((key) => field(key))}
          <Button
            size="sm"
            onClick={() => saveContact.mutate(values)}
            disabled={saveContact.isPending || !values.company_name?.trim()}
          >
            {saveContact.isPending ? 'Submitting…' : 'Submit'}
          </Button>
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
