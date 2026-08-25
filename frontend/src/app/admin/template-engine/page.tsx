'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import api from '@/lib/axios'

interface Project {
  id: string
  name: string
  slug: string
  is_default: boolean
}

// No more project-picker landing page (KDL-558) — goes straight to the
// default project's Studio flow, same way /projects/[projectId]/page.tsx
// already auto-routes to the first incomplete stage (or intake for a new run).
export default function StudioLandingPage() {
  return (
    <ModuleGuard slug="template-engine">
      <PermissionGuard permission="template-engine:view">
        <StudioRedirect />
      </PermissionGuard>
    </ModuleGuard>
  )
}

function StudioRedirect() {
  const router = useRouter()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const {
    data: projects,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['projects'],
    queryFn: () =>
      api
        .get<{ success: boolean; data: Project[] }>('/projects')
        .then((r) => r.data.data)
        .catch(() => null),
    staleTime: 30_000,
    enabled: isAuthenticated,
  })

  useEffect(() => {
    if (isLoading || !projects || projects.length === 0) return
    const target = projects.find((p) => p.is_default) ?? projects[0]
    if (!target) return
    router.replace(`/admin/template-engine/projects/${target.id}`)
  }, [isLoading, projects, router])

  if (isError || projects === null) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <p className="text-sm font-medium text-muted-foreground">Projects module not available</p>
        <p className="mt-1 text-xs text-muted-foreground">
          The projects module (<code>/api/projects</code>) is required to use Studio.
        </p>
      </div>
    )
  }

  if (!isLoading && projects?.length === 0) {
    return (
      <div className="max-w-xl mx-auto mt-12 rounded-xl border border-dashed bg-muted/30 p-8 text-center">
        <p className="text-sm font-medium">No projects yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Create a project in the projects module to start a Studio run.
        </p>
      </div>
    )
  }

  return <LoadingSpinner fullPage />
}
