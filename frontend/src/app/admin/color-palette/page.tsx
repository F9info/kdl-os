'use client'

import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { StudioStageRedirect } from '@/components/shared/StudioStageRedirect'

export default function ColorPalettePage() {
  return (
    <ModuleGuard slug="menus">
      <PermissionGuard permission="menus:view">
        <StudioStageRedirect title="Color Palette" stageSlug="palette" />
      </PermissionGuard>
    </ModuleGuard>
  )
}
