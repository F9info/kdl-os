'use client'

import { usePermissions } from '@/hooks/usePermissions'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { PermissionDenied } from '@/components/shared/PermissionDenied'

interface PermissionGuardProps {
  permission: string
  children: React.ReactNode
}

export function PermissionGuard({ permission, children }: PermissionGuardProps) {
  const { can, isLoading } = usePermissions()

  if (isLoading) {
    return <LoadingSpinner fullPage />
  }

  if (!can(permission)) {
    return <PermissionDenied />
  }

  return <>{children}</>
}
