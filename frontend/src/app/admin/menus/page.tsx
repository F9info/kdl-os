'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/admin/components/shared/StudioStageRedirect'
import { openWebsiteView, writeLocal } from '@/app/admin/template-engine/website-ui-state'

// Navigation has ONE editor: the Navigation step of the Web app (Frontend > Navigation). This address
// stays so the sidebar entry and old links keep working: it opens that editor, on the Footer menu for
// `?key=footer` and on the Header menu otherwise.
function OpenNavigation() {
  const key = useSearchParams().get('key') === 'footer' ? 'footer' : 'header'
  return (
    <StudioStageRedirect
      title="Navigation"
      stageSlug="website"
      query="?view=navigation"
      beforeOpen={(projectId) => {
        openWebsiteView(projectId, 'navigation')
        writeLocal(`te-website-ui:${projectId}:navMenu`, key)
      }}
    />
  )
}

export default function MenusPage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <Suspense fallback={null}>
          <OpenNavigation />
        </Suspense>
      </PermissionGuard>
    </ModuleGuard>
  )
}
