'use client'

import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'
import { applyIdentity } from '@/frontend/lib/apply-identity'
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
}: {
  data: never
  title: string
  projectId?: string
  identity?: Record<string, string>
}) {
  // A landing page brings its baked company identity: its header and footer blocks read it, like the live page does.
  const shown = identity ? applyIdentity(data, identity) : data
  return <Render config={config} data={applyHeaderOverlay(shown)} metadata={{ pageTitle: title, projectId, ...(identity && { identity }) }} />
}
