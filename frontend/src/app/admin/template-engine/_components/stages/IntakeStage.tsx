'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import {
  useAdvanceStage,
  useBrandKit,
  useRetryStage,
  useUploadLogo,
} from '@/hooks/useTemplateEngine'
import { StageShell } from './StageShell'
import { Button } from '@/components/ui/button'
import { FieldControl, type FieldState } from '@/app/admin/settings/_components/FieldControl'
import type { SettingField, Type } from '@/types/models.types'
import type { TemplateEngineRun } from '@/types/template-engine.types'

// Standalone Application Settings Type seeded by
// backend/prisma/seeders/brand-profile-fields.seed.js — global (not per-project),
// managed the same way as any other /admin/settings/fields entry.
const BRAND_PROFILE_TYPE_SLUG = 'brand-profile'

// Two-column layout order matching the prototype's "Logo & Contact Details"
// screen. Fields not paired here (secondary_phone, address1, address2) render
// full-width below.
const PAIRED_ROWS: Array<[string, string]> = [
  ['brand-profile-company-name', 'brand-profile-primary-email'],
  ['brand-profile-secondary-email', 'brand-profile-primary-phone'],
]
const FULL_WIDTH_SLUGS = [
  'brand-profile-secondary-phone',
  'brand-profile-address-1',
  'brand-profile-address-2',
]

export function IntakeStage({ run }: { run: TemplateEngineRun }) {
  const stage = run.stages.find((s) => s.stage === 'INTAKE')
  const advance = useAdvanceStage(run.id, run.projectId)
  const retry = useRetryStage(run.id, run.projectId)
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(run.projectId)
  const uploadLogo = useUploadLogo(run.projectId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()

  const { data } = useQuery({
    queryKey: ['setting-fields-by-type', BRAND_PROFILE_TYPE_SLUG],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${BRAND_PROFILE_TYPE_SLUG}`)
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  const fields = useMemo(() => data?.fields ?? [], [data])
  const bySlug = useMemo(() => Object.fromEntries(fields.map((f) => [f.slug, f])), [fields])

  const [form, setForm] = useState<Record<string, FieldState>>({})

  useEffect(() => {
    setForm((prev) => {
      if (Object.keys(prev).length > 0) return prev // don't clobber in-progress edits on refetch
      const next: Record<string, FieldState> = {}
      for (const f of fields) next[f.id] = { value: f.value ?? '', alt_text: f.alt_text ?? '' }
      return next
    })
  }, [fields])

  const saveMutation = useMutation({
    mutationFn: () => {
      const values = fields
        .filter((f) => f.slug !== 'brand-profile-logo') // Studio's own logo upload owns this field
        .map((f) => ({ id: f.id, value: form[f.id]?.value ?? '', alt_text: null }))
      return api.post('/setting-fields/values', { type_id: data!.type.id, values })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['setting-fields-by-type', BRAND_PROFILE_TYPE_SLUG] })
      toast({ title: 'Contact details saved' })
    },
    onError: () => toast({ title: 'Could not save contact details', variant: 'destructive' }),
  })

  const hasLogo = !!brandKit?.logo_media_id

  const { data: logoMedia } = useQuery({
    queryKey: ['media', brandKit?.logo_media_id],
    queryFn: () =>
      api
        .get(`/media/${brandKit!.logo_media_id}`)
        .then((r) => r.data.data.media as { url: string | null }),
    enabled: hasLogo,
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    uploadLogo.mutate(file)
    e.target.value = ''
  }

  const [showErrors, setShowErrors] = useState(false)

  function fieldRow(slug: string, errorMessage?: string) {
    const f = bySlug[slug]
    if (!f) return <div key={slug} />
    // Company name is required — mark it in the label without touching the
    // shared FieldControl component (used by every generic settings screen).
    // Every field here shares one Category ("Logo & Contact Details"), and
    // the card title already says that — FieldControl's per-field "Category: …"
    // hint would just repeat it 7 times, so it's stripped at this call site.
    const displayField = {
      ...f,
      category: undefined,
      field_name: slug === 'brand-profile-company-name' ? `${f.field_name} *` : f.field_name,
    }
    return (
      <div key={f.id}>
        <FieldControl
          field={displayField}
          state={form[f.id] ?? { value: '', alt_text: '' }}
          onChange={(patch) =>
            setForm((prev) => ({
              ...prev,
              [f.id]: { ...(prev[f.id] ?? { value: '', alt_text: '' }), ...patch },
            }))
          }
        />
        {errorMessage && <p className="mt-1 text-xs text-destructive">{errorMessage}</p>}
      </div>
    )
  }

  const companyField = bySlug['brand-profile-company-name']
  const companyValue = companyField ? (form[companyField.id]?.value ?? '') : ''
  const companyMissing = !companyValue.trim()
  const logoMissing = !hasLogo

  function handleNext() {
    if (companyMissing || logoMissing) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    saveMutation.mutate(undefined, {
      onSuccess: () => {
        if (stage?.status === 'FAILED') retry.mutate('INTAKE')
        else advance.mutate('INTAKE')
      },
    })
  }

  const isBusy = saveMutation.isPending || advance.isPending || retry.isPending

  return (
    <StageShell
      title="Overview"
      description="Upload your logo and enter your contact details, then submit to unlock Brand System."
      stage={stage ?? null}
      hideRunButton
    >
      <div className="grid gap-4 w-full">
        <div className="rounded-lg border bg-card px-6 py-6 space-y-4 [&_.th-input]:!px-4 [&_.th-input]:!py-2.5">
          {/* [&_.th-input] overrides theme-engine's Forms-pane padding token
              scoped to just this card, per user request not to touch the
              token itself (its computed value was too tight — text sat ~4px
              from the input border instead of a comfortable ~12-16px). */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Logo &amp; Contact Details</h3>
            {brandKit?.status && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                {brandKit.status}
              </span>
            )}
          </div>

          {/* Logo upload — stays wired to brand-kit's real pipeline (sanitization,
              retention, OKLCH palette extraction), not the generic settings-field
              upload, even though "Logo file" also exists as a standalone field. */}
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Logo file <span className="text-destructive">*</span>
            </p>
            <div className="flex items-center gap-3">
              {kitLoading ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : hasLogo ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              )}
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
                    {hasLogo ? 'Replace file' : 'Upload logo'}
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
              This image is what &ldquo;Prepare Brand System&rdquo; actually samples pixels from to
              build your colour palette.
            </p>
            {hasLogo && logoMedia?.url && (
              // eslint-disable-next-line @next/next/no-img-element -- external presigned MinIO URL, not a Next-optimizable local asset
              <img
                src={logoMedia.url}
                alt="Uploaded logo"
                className="h-16 w-16 rounded-md border object-contain bg-white p-1"
              />
            )}
            {showErrors && logoMissing && (
              <p className="text-xs text-destructive">Logo file is required.</p>
            )}
          </div>

          {PAIRED_ROWS.map(([left, right]) => (
            <div key={left} className="grid grid-cols-2 gap-4">
              {fieldRow(
                left,
                left === 'brand-profile-company-name' && showErrors && companyMissing
                  ? 'Company name is required.'
                  : undefined
              )}
              {fieldRow(right)}
            </div>
          ))}
          {FULL_WIDTH_SLUGS.map((slug) => fieldRow(slug))}

          <Button size="sm" onClick={handleNext} disabled={isBusy}>
            {isBusy ? 'Saving…' : 'Next'}
          </Button>
        </div>
      </div>
    </StageShell>
  )
}
