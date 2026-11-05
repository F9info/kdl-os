'use client'

import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/admin/components/shared/StudioStageRedirect'

export default function ColorPalettePage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <StudioStageRedirect title="Color Palette" stageSlug="palette" />
      </PermissionGuard>
    </ModuleGuard>
  )
}
