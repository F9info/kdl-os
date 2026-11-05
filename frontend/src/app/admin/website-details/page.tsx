'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { useDefaultProjectId } from '@/admin/hooks/useDefaultProjectId'
import { useContinueToPalette, useTemplateEngineRuns } from '@/admin/hooks/useTemplateEngine'
import { useIdentity } from '@/hooks/useIdentity'
import { useSiteHomeHref } from '@/admin/hooks/useSiteHomeHref'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { TypeSettingsForm } from '@/app/admin/settings/_components/TypeSettingsForm'

// About / Vision / Mission / tagline copy: the website-specific settings kept on this page.
const WEBSITE_CONTENT_TYPE_SLUG = 'website-content'

// Company name, logo and contact details are NOT edited here. They live once, in Settings >
// Identity, and every module (this website, print layouts, ...) reads them from there.
const SUMMARY_FIELDS: Array<[label: string, key: string]> = [
  ['Company name', 'app_name'],
  ['Email', 'contact_email'],
  ['Secondary email', 'contact_email_secondary'],
  ['Phone', 'contact_phone'],
  ['Secondary phone', 'contact_phone_secondary'],
  ['Address', 'contact_address'],
]

function WebsiteDetailsContent() {
  const router = useRouter()
  const { projectId, isLoading: projectResolving } = useDefaultProjectId()
  const { identity, isLoading: identityLoading } = useIdentity()
  const { data: runs } = useTemplateEngineRuns(projectId)
  const latestRun = runs?.[0]
  const continueToPalette = useContinueToPalette(projectId ?? '')

  const websiteOut = latestRun?.stages.find((st) => st.stage === 'WEBSITE')?.outputRef as
    { pageKeyToId?: Record<string, string> } | null | undefined
  const frontendHref = useSiteHomeHref(websiteOut?.pageKeyToId)

  const hasName = !!identity.app_name?.trim()
  const hasLogo = !!identity.logo_light
  const ready = hasName && hasLogo

  if (projectResolving) return null
  if (!projectId) {
    return (
      <div>
        <PageHeader title="Website Details" />
        <p className="mt-4 text-sm text-muted-foreground">
          No project exists yet. Create one first.
        </p>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Website Details"
        breadcrumbs={[{ label: 'Content' }, { label: 'Website Details' }]}
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

      <section
        className="max-w-3xl space-y-4 rounded-lg border bg-card px-6 py-6"
        aria-labelledby="wd-company"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="wd-company" className="text-sm font-medium">
              Company details
            </h3>
            <p className="text-xs text-muted-foreground">
              Managed once in Settings &gt; Identity. Your website, print layouts and every other
              module use these.
            </p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/settings/identity">Edit in Identity</Link>
          </Button>
        </div>

        {identityLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row">
            {hasLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL
              <img
                src={identity.logo_light}
                alt="Company logo"
                className="h-16 w-16 shrink-0 rounded-md border bg-white object-contain p-1"
              />
            )}
            <dl className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              {SUMMARY_FIELDS.filter(([, key]) => identity[key]?.trim()).map(([label, key]) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="break-words">{identity[key]}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <div className="space-y-1.5 text-sm">
          <p className="flex items-center gap-2">
            {hasName ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            Company name {hasName ? 'set' : 'missing'}
          </p>
          <p className="flex items-center gap-2">
            {hasLogo ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            )}
            Logo {hasLogo ? 'set' : 'missing'} (your colour palette is built from it)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={!ready || continueToPalette.isPending}
            onClick={() =>
              continueToPalette.mutate(latestRun, {
                onSuccess: () =>
                  router.push(`/admin/template-engine/projects/${projectId}/palette`),
              })
            }
          >
            {continueToPalette.isPending ? 'Opening…' : 'Next: Color Palette'}
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          {!ready && (
            <span className="text-xs text-muted-foreground">
              Add the missing details in Identity to continue.
            </span>
          )}
        </div>
      </section>

      <div className="mt-6 max-w-3xl">
        <h3 className="mb-3 text-sm font-medium">Website Content</h3>
        <TypeSettingsForm slug={WEBSITE_CONTENT_TYPE_SLUG} />
      </div>
    </div>
  )
}

export default function WebsiteDetailsPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <WebsiteDetailsContent />
      </PermissionGuard>
    </ModuleGuard>
  )
}
