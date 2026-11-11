'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ProviderForm } from '../../_components/ProviderForm'
import { PROVIDER_PRESETS } from '../../_components/providerPresets'

function NewProvider() {
  const key = (useSearchParams().get('provider') ?? 'CUSTOM').toUpperCase()
  return <ProviderForm kind={PROVIDER_PRESETS[key] ? key : 'CUSTOM'} />
}

export default function NewProviderPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:add">
        <Suspense>
          <NewProvider />
        </Suspense>
      </PermissionGuard>
    </ModuleGuard>
  )
}
