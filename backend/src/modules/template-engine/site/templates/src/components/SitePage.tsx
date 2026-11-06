'use client'

import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'
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
}: {
  data: never
  title: string
  projectId?: string
}) {
  return <Render config={config} data={applyHeaderOverlay(data)} metadata={{ pageTitle: title, projectId }} />
}
