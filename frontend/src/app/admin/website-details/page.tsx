'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, CheckCircle2, AlertCircle, Loader2, ArrowRight, ExternalLink } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { useDefaultProjectId } from '@/hooks/useDefaultProjectId'
import {
  useAdvanceStage,
  useBrandKit,
  useContinueToPalette,
  useTemplateEngineRuns,
  useUploadLogo,
} from '@/hooks/useTemplateEngine'
import { useSiteHomeHref } from '@/hooks/useSiteHomeHref'
import { PageHeader } from '@/components/layout/PageHeader'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { FieldControl, type FieldState } from '@/app/admin/settings/_components/FieldControl'
import { TypeSettingsForm } from '@/app/admin/settings/_components/TypeSettingsForm'
import type { SettingField, Type } from '@/types/models.types'

// Same global "brand-profile" settings type the Template Engine intake used —
// this page is now the one place to edit it.
const BRAND_PROFILE_TYPE_SLUG = 'brand-profile'
// About / Vision / Mission / tagline copy — edited here too, on the same page.
const WEBSITE_CONTENT_TYPE_SLUG = 'website-content'

const PAIRED_ROWS: Array<[string, string]> = [
  ['brand-profile-company-name', 'brand-profile-primary-email'],
  ['brand-profile-secondary-email', 'brand-profile-primary-phone'],
]
const FULL_WIDTH_SLUGS = [
  'brand-profile-secondary-phone',
  'brand-profile-address-1',
  'brand-profile-address-2',
]

function CompanyDetailsContent() {
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(projectId)
  const uploadLogo = useUploadLogo(projectId ?? '')
  const { data: runs } = useTemplateEngineRuns(projectId)
  const latestRun = runs?.[0]
  const advance = useAdvanceStage(latestRun?.id ?? '', projectId ?? '')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const router = useRouter()
  const continueToPalette = useContinueToPalette(projectId ?? '')
  // true from a successful Save until the form is edited again — the Next button shows meanwhile
  const [saved, setSaved] = useState(false)

  const { data } = useQuery({
    queryKey: ['setting-fields-by-type', BRAND_PROFILE_TYPE_SLUG],
    queryFn: () =>
      api
        .get(`/setting-fields/by-type/${BRAND_PROFILE_TYPE_SLUG}`)
        .then((r) => r.data.data as { type: Type; fields: SettingField[] }),
  })

  const websiteOut = latestRun?.stages.find((st) => st.stage === 'WEBSITE')?.outputRef as
    { pageKeyToId?: Record<string, string> } | null | undefined
  const frontendHref = useSiteHomeHref(websiteOut?.pageKeyToId)

  const fields = useMemo(() => data?.fields ?? [], [data])
  const bySlug = useMemo(() => Object.fromEntries(fields.map((f) => [f.slug, f])), [fields])
  const [form, setForm] = useState<Record<string, FieldState>>({})
  const [showErrors, setShowErrors] = useState(false)

  useEffect(() => {
    setForm((prev) => {
      if (Object.keys(prev).length > 0) return prev // don't clobber in-progress edits on refetch
      const next: Record<string, FieldState> = {}
      for (const f of fields) next[f.id] = { value: f.value ?? '', alt_text: f.alt_text ?? '' }
      return next
    })
  }, [fields])

  // Website pages bake brand name/logo in at generation time, so re-sync an
  // already-built site after any change. No-op until the Website stage has run.
  function resyncWebsiteIfBuilt() {
    if (latestRun?.stages.find((st) => st.stage === 'WEBSITE')?.status !== 'DONE') return
    let navigationPages: string[] = []
    try {
      const raw = window.localStorage.getItem(`te-website-ui:${projectId}:navigation`)
      navigationPages = raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      // storage unavailable/corrupt — falls back to the default page set
    }
    advance.mutate({ stage: 'WEBSITE', body: { navigationPages } })
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const values = fields
        .filter((f) => f.slug !== 'brand-profile-logo') // logo is uploaded via brand-kit below
        .map((f) => ({ id: f.id, value: form[f.id]?.value ?? '', alt_text: null }))
      return api.post('/setting-fields/values', { type_id: data!.type.id, values })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['setting-fields-by-type', BRAND_PROFILE_TYPE_SLUG] })
      toast({ title: 'Company details saved' })
      setSaved(true)
      resyncWebsiteIfBuilt()
    },
    onError: () => toast({ title: 'Could not save company details', variant: 'destructive' }),
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

  const companyField = bySlug['brand-profile-company-name']
  const companyMissing = !(companyField ? (form[companyField.id]?.value ?? '') : '').trim()

  function handleSave() {
    if (companyMissing) {
      setShowErrors(true)
      return
    }
    setShowErrors(false)
    saveMutation.mutate()
  }

  function fieldRow(slug: string, errorMessage?: string) {
    const f = bySlug[slug]
    if (!f) return <div key={slug} />
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
          onChange={(patch) => {
            setSaved(false)
            setForm((prev) => ({
              ...prev,
              [f.id]: { ...(prev[f.id] ?? { value: '', alt_text: '' }), ...patch },
            }))
          }}
        />
        {errorMessage && <p className="mt-1 text-xs text-destructive">{errorMessage}</p>}
      </div>
    )
  }

  if (projectResolving) return null
  if (!projectId) {
    return (
      <div>
        <PageHeader title="Company Details" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet. Create one first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Company Details"
        breadcrumbs={[{ label: 'CMS' }, { label: 'Company Details' }]}
        action={
          frontendHref ? (
            <Button asChild className="gap-2">
              <a href={frontendHref} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
                View Frontend
              </a>
            </Button>
          ) : (
            <Button
              className="gap-2"
              disabled
              title="No website generated yet — enable CMS and complete the Website step"
            >
              <ExternalLink className="h-4 w-4" />
              View Frontend
            </Button>
          )
        }
      />
      <div className="rounded-lg border bg-card px-6 py-6 space-y-4 [&_.th-input]:!px-4 [&_.th-input]:!py-2.5">
        <h3 className="text-sm font-medium">Logo &amp; Contact Details</h3>

        <div className="space-y-2">
          <p className="text-sm font-medium">Logo file</p>
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
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadLogo.mutate(file, { onSuccess: resyncWebsiteIfBuilt })
                e.target.value = ''
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your brand colour palette is built from this image.
          </p>
          {hasLogo && logoMedia?.url && (
            // eslint-disable-next-line @next/next/no-img-element -- external presigned MinIO URL
            <img
              src={logoMedia.url}
              alt="Uploaded logo"
              className="h-16 w-16 rounded-md border object-contain bg-white p-1"
            />
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

        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
          {/* Appears after a successful Save: continues the setup to the Color Palette page. */}
          {saved && (
            <>
              <Button
                size="sm"
                disabled={!hasLogo || continueToPalette.isPending}
                onClick={() =>
                  continueToPalette.mutate(latestRun, {
                    onSuccess: () =>
                      router.push(`/admin/template-engine/projects/${projectId}/palette`),
                  })
                }
              >
                {continueToPalette.isPending ? 'Opening…' : 'Next'}
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
              {!hasLogo && (
                <span className="text-xs text-muted-foreground">
                  Upload your logo above to continue to the Color Palette.
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-6 max-w-3xl">
        <h3 className="mb-3 text-sm font-medium">Website Content</h3>
        <TypeSettingsForm slug={WEBSITE_CONTENT_TYPE_SLUG} />
      </div>
    </div>
  )
}

export default function CompanyDetailsPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <CompanyDetailsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
