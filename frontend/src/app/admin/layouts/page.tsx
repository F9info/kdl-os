'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/components/shared/StudioStageRedirect'
import { openWebsiteView } from '@/app/admin/template-engine/website-ui-state'

// CMS → Layouts: opens the Web app "Layouts" view (layout settings only).
export default function LayoutsPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <StudioStageRedirect
          title="Layouts"
          stageSlug="website"
          query="?view=layouts"
          beforeOpen={(projectId) => openWebsiteView(projectId, 'layouts')}
        />
      </PermissionGuard>
    </ModuleGuard>
  )
}
