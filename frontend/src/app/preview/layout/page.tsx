'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { LayoutPreview } from '@/admin/components/layouts/LayoutPreview'
import type { LayoutKind } from '@/admin/hooks/useLayoutLibrary'

// Only drawn inside the layout screens' preview frame: an iframe of the chosen device width, so the design's
// own responsive rules (viewport breakpoints) apply. The design is passed in the address; nothing is saved.
function Inner() {
  const q = useSearchParams()
  const projectId = q.get('projectId') ?? ''
  const kind = (q.get('kind') ?? 'HEADER') as LayoutKind
  const variant = q.get('variant') ?? '1'
  let config: Record<string, string> = {}
  try {
    const parsed = JSON.parse(q.get('config') ?? '{}')
    if (parsed && typeof parsed === 'object') config = parsed as Record<string, string>
  } catch {
    config = {}
  }
  if (!projectId) return null
  return (
    <div className="min-h-screen bg-white">
      <LayoutPreview
        projectId={projectId}
        kind={kind}
        variant={variant}
        config={config}
        scale={1}
      />
    </div>
  )
}

export default function LayoutPreviewPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  )
}
