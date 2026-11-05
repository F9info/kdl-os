'use client'

import { Render } from '@puckeditor/core'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'
import { applyIdentity, mergeIdentity } from '@/frontend/lib/apply-identity'
import { applySiteLayout } from '@/lib/apply-site-layout'
import { config } from '@/frontend/blocks/puck.config'
import type { PageRecord } from '@/frontend/pages/page-record'

/**
 * Renders a public page the same way everywhere (site URLs, /p/<slug>, signed previews): the
 * editor's own `config`, with the project's header/footer layout and the live company identity
 * (plus any per-site overrides) applied on top of the stored content.
 */
export function PageRender({
  page,
  identity,
}: {
  page: PageRecord
  identity: Record<string, string>
}) {
  return (
    <Render
      config={config}
      data={applyHeaderOverlay(
        applyIdentity(
          applySiteLayout(page.data, page.layout),
          mergeIdentity(identity, page.identity)
        )
      )}
      metadata={{ pageTitle: page.title, projectId: page.projectId ?? undefined }}
    />
  )
}
