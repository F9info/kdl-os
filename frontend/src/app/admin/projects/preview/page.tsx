'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Monitor, Smartphone, Tablet } from 'lucide-react'
import { createPreviewLink, listPages } from '@/app/admin/page-builder/store'
import { PageHeader } from '@/admin/components/layout/PageHeader'
import { PermissionGuard } from '@/admin/components/shared/PermissionGuard'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LoadingState } from '@/components/ui/loading-state'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { useProjectStore } from '@/stores/project.store'

const DEVICES = [
  { key: 'desktop', label: 'Desktop', width: 1280, icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: 820, icon: Tablet },
  { key: 'mobile', label: 'Mobile', width: 390, icon: Smartphone },
] as const

function PreviewInner() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const pages = useQuery({ queryKey: ['pages-for-preview', activeProjectId], queryFn: () => listPages() })
  const [index, setIndex] = useState(0)
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[0])
  const page = pages.data?.[index]
  // A signed link shows the working copy (drafts included) without a login, in the frame.
  const link = useQuery({
    queryKey: ['preview-link', page?.id],
    enabled: !!page,
    staleTime: 60 * 60 * 1000,
    queryFn: () => createPreviewLink(page!.id, 2),
  })
  useEffect(() => setIndex(0), [activeProjectId])

  if (pages.isLoading) return <LoadingState />
  if (pages.error) return <ErrorAlert error={pages.error} />
  if (!pages.data?.length) return <EmptyState title="No pages yet" description="Create a page to preview it." />

  const count = pages.data.length
  return (
    <>
      <PageHeader title="Preview" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" aria-label="Previous page" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <select
          aria-label="Page"
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        >
          {pages.data.map((p, i) => (
            <option key={p.id} value={i}>
              {p.title} {p.status === 'PUBLISHED' ? '' : '(draft)'}
            </option>
          ))}
        </select>
        <Button size="sm" variant="outline" aria-label="Next page" disabled={index >= count - 1} onClick={() => setIndex(index + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">
          {index + 1} of {count}
        </span>
        <div className="ml-auto flex gap-1" role="group" aria-label="Device">
          {DEVICES.map((d) => (
            <Button
              key={d.key}
              size="sm"
              variant={d.key === device.key ? 'default' : 'outline'}
              aria-pressed={d.key === device.key}
              onClick={() => setDevice(d)}
            >
              <d.icon className="mr-2 h-3.5 w-3.5" />
              {d.label}
            </Button>
          ))}
        </div>
      </div>
      <ErrorAlert error={link.error} className="mb-4" />
      <div className="overflow-auto rounded-lg border bg-muted/40 p-4">
        {link.data ? (
          <iframe
            title={`Preview of ${page?.title} on ${device.label}`}
            data-testid="preview-frame"
            src={`/preview/${link.data.token}`}
            style={{ width: device.width, maxWidth: 'none', height: '75vh' }}
            className="mx-auto block rounded border bg-white"
          />
        ) : (
          <LoadingState />
        )}
      </div>
    </>
  )
}

export default function ProjectPreviewPage() {
  return (
    <PermissionGuard permission="page-builder:view">
      <PreviewInner />
    </PermissionGuard>
  )
}
