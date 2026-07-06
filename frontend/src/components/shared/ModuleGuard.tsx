'use client'

import { useModules } from '@/hooks/useModules'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'

interface ModuleGuardProps {
  slug: string
  children: React.ReactNode
}

export function ModuleGuard({ slug, children }: ModuleGuardProps) {
  const { isEnabled, isLoading } = useModules()

  if (isLoading) {
    return <LoadingSpinner fullPage />
  }

  if (!isEnabled(slug)) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-900">Module not available</p>
          <p className="mt-1 text-sm text-gray-500">
            The &quot;{slug}&quot; module is not currently enabled.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
