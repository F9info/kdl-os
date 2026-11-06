'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Render } from '@puckeditor/core'
import { ArrowLeft } from 'lucide-react'
import { config } from '@/frontend/blocks/puck.config'
import { useLandingTemplatePreview } from '@/admin/hooks/useLandingPages'
import { usePermissions } from '@/admin/hooks/usePermissions'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingState } from '@/components/ui/loading-state'
import { Button } from '@/components/ui/button'

/**
 * "View template": the whole landing page a template would create, drawn by the same renderer the
 * public site uses, full screen over the admin chrome. Nothing is created. "Use this template" goes
 * back to the list with the New dialog open on this template.
 */
function TemplatePreview() {
  const { key } = useParams<{ key: string }>()
  const router = useRouter()
  const { can } = usePermissions()
  const { data, isLoading, error } = useLandingTemplatePreview(key)

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-white" data-testid="template-preview">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-2.5 shadow-sm">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/landing-pages">
              <ArrowLeft className="h-4 w-4" />
              Back to templates
            </Link>
          </Button>
          <div>
            <div className="text-sm font-semibold">{data?.name ?? 'Template preview'}</div>
            <div className="text-xs text-muted-foreground">
              Preview only. Nothing is created until you use it.
            </div>
          </div>
        </div>
        {can('landing:add') && (
          <Button
            size="sm"
            onClick={() => router.push(`/admin/landing-pages?use=${encodeURIComponent(key)}`)}
          >
            Use this template
          </Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <LoadingState />
        ) : error || !data ? (
          <div className="p-6">
            <ErrorAlert error={error ?? new Error('Template not found')} />
          </div>
        ) : (
          <Render
            config={config}
            data={data.data}
            metadata={{ pageTitle: data.name, preview: true }}
          />
        )}
      </div>
    </div>
  )
}

export default function TemplatePreviewPage() {
  return (
    <ModuleGuard slug="landing">
      <PermissionGuard permission="landing:view">
        <TemplatePreview />
      </PermissionGuard>
    </ModuleGuard>
  )
}
