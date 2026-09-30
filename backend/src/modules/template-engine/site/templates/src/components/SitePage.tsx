'use client'

import { Render } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'

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
  return <Render config={config} data={data} metadata={{ pageTitle: title, projectId }} />
}
