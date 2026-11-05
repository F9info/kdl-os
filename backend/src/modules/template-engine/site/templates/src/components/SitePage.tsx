'use client'

import { Render } from '@puckeditor/core'
import { config } from '@/frontend/blocks/puck.config'
import { applyHeaderOverlay } from '@/frontend/lib/header-overlay'

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
