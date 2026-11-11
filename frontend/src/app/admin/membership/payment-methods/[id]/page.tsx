'use client'

import { useParams } from 'next/navigation'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Skeleton } from '@/components/ui/skeleton'
import { useAdminItem, type Provider } from '@/admin/hooks/useMembership'
import { ProviderForm } from '../../_components/ProviderForm'

function EditProvider() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, error } = useAdminItem<Provider>(`payment-providers/${id}`)
  if (error) return <ErrorAlert error={error} />
  if (isLoading || !data) return <Skeleton className="h-64 w-full" />
  // keyed so a refetch after save does not leave stale defaults
  return <ProviderForm key={data.id + data.status} kind={data.provider} provider={data} />
}

export default function EditProviderPage() {
  return (
    <ModuleGuard slug="membership">
      <PermissionGuard permission="membership:view">
        <EditProvider />
      </PermissionGuard>
    </ModuleGuard>
  )
}
