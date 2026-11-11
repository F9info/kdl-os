'use client'

import { Render } from '@puckeditor/core'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { getPageBySiteKey } from '@/frontend/pages/page-record'
import { isMemberOnly } from '@/frontend/membership/roles'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'
import { applyIdentity, mergeIdentity } from '@/frontend/lib/apply-identity'
import { applySiteLayout } from '@/lib/apply-site-layout'
import { config } from '@/frontend/blocks/puck.config'
import { hasChrome, memberLoginLinks, withSharedChrome } from '@/frontend/membership/siteChrome'
import type { PageRecord } from '@/frontend/pages/page-record'

/**
 * Renders a public page the same way everywhere (site URLs, /p/<slug>, signed previews): the
 * editor's own `config`, with the project's header/footer layout and the live company identity
 * (plus any per-site overrides) applied on top of the stored content. The top bar, header and
 * footer come from the home page (see withSharedChrome); `ownChrome` keeps the page's own.
 */
export function PageRender({
  page,
  identity,
  ownChrome = false,
}: {
  page: PageRecord
  identity: Record<string, string>
  /** Skip the shared header/footer (the member shell renders the home chrome itself). */
  ownChrome?: boolean
}) {
  const live = mergeIdentity(identity, page.identity)
  const shared = !ownChrome && hasChrome(page.data)
  const { data: home, isLoading } = useQuery({
    queryKey: ['public-site-page', 'home'],
    queryFn: () => getPageBySiteKey('home'),
    retry: false,
    enabled: shared,
  })
  const { isAuthenticated, user } = useAuthStore()
  // Hold the page back until the home chrome is known, so the old header never flashes.
  if (shared && isLoading) return null
  const content = shared
    ? withSharedChrome(page.data, home?.data, isAuthenticated && isMemberOnly(user))
    : page.data
  return (
    <Render
      config={config}
      data={memberLoginLinks(
        applyHeaderOverlay(applyIdentity(applySiteLayout(content, page.layout), live))
      )}
      // `identity` (project identity plus this site's overrides) feeds blocks that show company
      // details themselves, such as the Landing footer.
      metadata={{
        pageTitle: page.title,
        projectId: page.projectId ?? undefined,
        identity: live,
      }}
    />
  )
}
