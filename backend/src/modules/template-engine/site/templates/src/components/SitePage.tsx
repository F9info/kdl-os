'use client'

import { useEffect, useState } from 'react'
import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'
import { applyIdentity, mergeIdentity } from '@/frontend/lib/apply-identity'
import { memberLoginLinks, withSharedChrome } from '@/frontend/membership/siteChrome'
import { applySiteLayout } from '@/lib/apply-site-layout'
import { patchFetchForStaticSite } from '@/frontend/lib/static-site'

// Static export on another host: blocks call relative `/api/...`; NEXT_PUBLIC_API_BASE points them at
// the Web app when an address was given, and with none those calls are refused at once (the blocks
// then show the content baked into the page). Installed at module load, before any block fetches.
if (typeof window !== 'undefined') {
  patchFetchForStaticSite(window, {
    staticSite: process.env.NEXT_PUBLIC_STATIC_SITE === '1',
    apiBase: process.env.NEXT_PUBLIC_API_BASE,
  })
}

// Same renderer + config as the admin's public /p/<slug> page.
export default function SitePage({
  data,
  title,
  projectId,
  identity,
  shared,
}: {
  data: never
  title: string
  projectId?: string
  identity?: Record<string, string>
  /** Home page + saved layout: one header/footer for every page, as on the live site. */
  shared?: { home: never | null; layout: never | null }
}) {
  // A landing page brings its baked company identity: its header and footer blocks read it, like the live page does.
  // Live company name + logo from the app (like the live site), so changing it in admin shows here without
  // regenerating. Offline / static export: the fetch is refused and the brand stored in the page stays.
  const [live, setLive] = useState<Record<string, string>>({})
  useEffect(() => {
    let off = false
    fetch('/api/app-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && j?.data?.identity && setLive(j.data.identity))
      .catch(() => {})
    return () => {
      off = true
    }
  }, [])
  // A landing page keeps its own header/footer and its baked identity (site overrides on top of the live one);
  // every other page takes the home page's chrome, then the saved layout, then the live company identity.
  const shown = identity
    ? applyIdentity(data, mergeIdentity(live, identity))
    : applyIdentity(shared ? applySiteLayout(withSharedChrome(data, shared.home), shared.layout) : data, live)
  return <Render config={config} data={memberLoginLinks(applyHeaderOverlay(shown))} metadata={{ pageTitle: title, projectId, ...(identity && { identity }) }} />
}
