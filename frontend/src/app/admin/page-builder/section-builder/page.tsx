'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { ComposerCanvas } from '../packs/composer/ComposerCanvas'
import { getDefaultProjectId } from '../packs/composer/custom-blocks-store'

/**
 * Section Builder — a real, full-page screen for building a brand-new custom
 * section from atomic elements (heading, paragraph, button, image, columns,
 * testimonial, ...), reached via any "Insert a block" flow's "Create new"
 * card. Not a modal: it has its own URL, survives a refresh, and the browser
 * back button returns to wherever it was opened from (`returnTo`).
 *
 * `category` pins which block category the finished section will be filed
 * under (so it shows up back in that category's Insert-a-block picker).
 * `projectId` carries the single-project scoping key transparently — the
 * operator never sees or picks it (see KDL "no projects concept" removal);
 * falls back to the one default project when the caller has none in scope.
 */
export default function SectionBuilderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const category = searchParams.get('category') ?? ''
  // Open-redirect guard: `returnTo` is caller-controlled (query param) and
  // fed straight to router.push — must be a same-origin admin path, never
  // an absolute/protocol-relative URL (`//evil.com`, `https://evil.com`)
  // that a crafted link could use to bounce an admin off-site on close/save.
  const rawReturnTo = searchParams.get('returnTo') ?? ''
  const returnTo =
    rawReturnTo.startsWith('/admin/') && !rawReturnTo.startsWith('//')
      ? rawReturnTo
      : '/admin/template-engine'
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '')

  useEffect(() => {
    if (projectId) return
    getDefaultProjectId().then(setProjectId)
  }, [projectId])

  if (!category) {
    return (
      <ModuleGuard slug="page-builder">
        <div className="p-8 text-sm text-muted-foreground">
          Missing block category — open Section Builder from an &quot;Insert a block&quot;
          screen&apos;s &quot;Create new&quot; button.
        </div>
      </ModuleGuard>
    )
  }

  return (
    <ModuleGuard slug="page-builder">
      <div className="fixed inset-0 z-[100]">
        {projectId ? (
          <ComposerCanvas
            projectId={projectId}
            categoryKey={category}
            onClose={() => router.push(returnTo)}
            onSaved={() => router.push(returnTo)}
          />
        ) : (
          <LoadingSpinner fullPage />
        )}
      </div>
    </ModuleGuard>
  )
}
