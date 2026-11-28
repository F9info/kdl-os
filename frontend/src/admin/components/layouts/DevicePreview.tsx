'use client'

import { useState } from 'react'
import { Monitor, Smartphone, Tablet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LayoutKind } from '@/admin/hooks/useLayoutLibrary'

const DEVICES = [
  { key: 'desktop', label: 'Desktop', width: 1280, scale: 0.6, icon: Monitor },
  { key: 'tablet', label: 'Tablet', width: 768, scale: 0.8, icon: Tablet },
  { key: 'mobile', label: 'Mobile', width: 390, scale: 1, icon: Smartphone },
] as const

/** Address of the preview frame for a design (see app/preview/layout/page.tsx). */
export function layoutPreviewSrc(p: {
  projectId: string
  kind: LayoutKind
  variant: string
  config?: Record<string, string>
}) {
  const q = new URLSearchParams({ projectId: p.projectId, kind: p.kind, variant: p.variant })
  if (p.config && Object.keys(p.config).length > 0) q.set('config', JSON.stringify(p.config))
  return `/preview/layout?${q.toString()}`
}

/**
 * The design in a desktop, tablet or phone wide frame. The frame is a real iframe of that width, so the
 * design's responsive breakpoints apply as they would on a visitor's device.
 */
export function DevicePreview({ src, height = 360 }: { src: string; height?: number }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]['key']>('desktop')
  const d = DEVICES.find((x) => x.key === device)!
  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="group" aria-label="Preview size">
        {DEVICES.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={device === key ? 'default' : 'outline'}
            aria-pressed={device === key}
            onClick={() => setDevice(key)}
            className="gap-1.5"
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Button>
        ))}
      </div>
      <div className="overflow-auto rounded-md border bg-muted/30 p-2">
        <div
          className="mx-auto overflow-hidden rounded border bg-white"
          style={{ width: d.width * d.scale, height: height * d.scale, maxWidth: '100%' }}
        >
          <iframe
            key={`${device}-${src}`}
            src={src}
            title={`${d.label} preview`}
            style={{
              width: d.width,
              height,
              border: 0,
              transform: `scale(${d.scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  )
}
