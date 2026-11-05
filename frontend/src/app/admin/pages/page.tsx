'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/components/shared/StudioStageRedirect'
import { openWebsiteView } from '@/app/admin/template-engine/website-ui-state'

// CMS → Pages: opens the Web app "Pages" view (layout settings + the page grid).
export default function PagesPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <StudioStageRedirect
          title="Pages"
          stageSlug="website"
          query="?view=pages"
          beforeOpen={(projectId) => openWebsiteView(projectId, 'pages')}
        />
      </PermissionGuard>
    </ModuleGuard>
  )
}
