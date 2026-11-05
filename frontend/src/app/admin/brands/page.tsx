'use client'

import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/admin/components/shared/StudioStageRedirect'
import { openWebsiteView } from '@/app/admin/template-engine/website-ui-state'

export default function BrandsPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <StudioStageRedirect
          title="Brands"
          stageSlug="website"
          beforeOpen={(projectId) => openWebsiteView(projectId, 'brands')}
        />
      </PermissionGuard>
    </ModuleGuard>
  )
}
