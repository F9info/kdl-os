'use client'

import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'

// Static export on another host: blocks call relative `/api/...`; NEXT_PUBLIC_API_BASE points them
// at the real backend. Installed at module load so it is in place before any block fetches.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE
if (typeof window !== 'undefined' && API_BASE) {
  const w = window as typeof window & { __kdlFetchPatched?: boolean }
  if (!w.__kdlFetchPatched) {
    w.__kdlFetchPatched = true
    const original = window.fetch.bind(window)
    window.fetch = (input, init) =>
      typeof input === 'string' && input.startsWith('/api/')
        ? original(API_BASE.replace(/\/$/, '') + input, init)
        : original(input, init)
  }
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
