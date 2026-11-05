'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useDefaultProjectId } from '@/hooks/useDefaultProjectId'
import { useBrandKit, useContinueToPalette, useTemplateEngineRuns } from '@/hooks/useTemplateEngine'
import { PageHeader } from '@/components/layout/PageHeader'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'

/**
 * A fixed sidebar address (CMS → Color Palette / Brands) for a Template Engine stage page,
 * which lives under a per-project URL. Opens it for the default project, making sure a run
 * exists and the Overview step is done. Without a logo it points to Company Details instead.
 */
export function StudioStageRedirect({
  title,
  stageSlug,
  beforeOpen,
  query = '',
}: {
  title: string
  stageSlug: string
  /** Runs just before navigating — e.g. to pre-select which view of the stage page opens. */
  beforeOpen?: (projectId: string) => void
  /** Appended to the stage URL, e.g. '?view=pages' (lets the sidebar highlight the right entry). */
  query?: string
}) {
  const router = useRouter()
  const { projectId, isLoading: projectLoading } = useDefaultProjectId()
  const { data: runs, isLoading: runsLoading } = useTemplateEngineRuns(projectId)
  const { data: brandKit, isLoading: kitLoading } = useBrandKit(projectId)
  const open = useContinueToPalette(projectId ?? '')
  const started = useRef(false)

  const loading = projectLoading || runsLoading || kitLoading
  const hasLogo = !!brandKit?.logo_media_id

  useEffect(() => {
    if (loading || !projectId || !hasLogo || started.current) return
    started.current = true
    open.mutate(runs?.[0], {
      onSuccess: () => {
        beforeOpen?.(projectId)
        router.replace(`/admin/template-engine/projects/${projectId}/${stageSlug}${query}`)
      },
      onError: () => {
        started.current = false
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, projectId, hasLogo])

  return (
    <div>
      <PageHeader title={title} breadcrumbs={[{ label: 'CMS' }, { label: title }]} />
      {loading || (hasLogo && !open.isError) ? (
        <LoadingSpinner />
      ) : !hasLogo ? (
        <div className="max-w-md space-y-3 rounded-lg border bg-card p-6 text-sm">
          <p>Your {title} are built from your logo. Add your logo and company details first.</p>
          <Button size="sm" asChild>
            <Link href="/admin/website-details">Go to Company Details</Link>
          </Button>
        </div>
      ) : (
        <div className="max-w-md space-y-3 rounded-lg border bg-card p-6 text-sm">
          <p>Could not open {title}. Check your Company Details, then try again.</p>
          <Button
            size="sm"
            onClick={() => {
              started.current = false
              open.reset()
              window.location.reload()
            }}
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  )
}
