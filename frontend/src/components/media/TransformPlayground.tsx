'use client'

// B7 — Transform playground: interactive controls, debounced preview, copy URL, size indicator

import { useState, useEffect, useRef, useCallback } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageFormat = 'webp' | 'avif' | 'jpg' | 'png'
type FitMode = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'

interface TransformParams {
  width: number
  height: number
  format: ImageFormat
  quality: number
  blur: number
  grayscale: boolean
  fit: FitMode
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(mediaId: string, params: TransformParams): string {
  const p = new URLSearchParams()
  p.set('w', String(params.width))
  p.set('h', String(params.height))
  p.set('format', params.format)
  p.set('q', String(params.quality))
  if (params.blur > 0) p.set('blur', String(params.blur))
  if (params.grayscale) p.set('gray', '1')
  p.set('fit', params.fit)
  return `/api/media/${mediaId}/t?${p.toString()}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

// ─── Slider row ───────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatValue,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  formatValue?: (v: number) => string
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <Label>{label}</Label>
        <span className="text-muted-foreground tabular-nums">
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 accent-primary"
      />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface TransformPlaygroundProps {
  mediaId: string
  mediaType: string
}

export function TransformPlayground({ mediaId, mediaType }: TransformPlaygroundProps) {
  const [params, setParams] = useState<TransformParams>({
    width: 800,
    height: 600,
    format: 'webp',
    quality: 80,
    blur: 0,
    grayscale: false,
    fit: 'cover',
  })

  const [fileSize, setFileSize] = useState<number | null>(null)
  const [sizeLoading, setSizeLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const debouncedParams = useDebounce(params, 500)
  const previewUrl = buildUrl(mediaId, debouncedParams)

  const set = useCallback(<K extends keyof TransformParams>(key: K, value: TransformParams[K]) => {
    setParams((p) => ({ ...p, [key]: value }))
  }, [])

  // Fetch file size via HEAD request
  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setSizeLoading(true)
    setFileSize(null)

    fetch(previewUrl, { method: 'HEAD', signal: controller.signal })
      .then((res) => {
        const len = res.headers.get('content-length')
        if (len) setFileSize(parseInt(len, 10))
      })
      .catch(() => { /* aborted or failed — no-op */ })
      .finally(() => {
        if (!controller.signal.aborted) setSizeLoading(false)
      })
  }, [previewUrl])

  const copyUrl = async () => {
    const full = typeof window !== 'undefined'
      ? `${window.location.origin}${previewUrl}`
      : previewUrl
    try {
      await navigator.clipboard.writeText(full)
      toast({ title: 'URL copied!' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  if (mediaType !== 'IMAGE') {
    return (
      <p className="text-sm text-muted-foreground">
        Transform playground is only available for images.
      </p>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Controls */}
      <div className="lg:w-64 flex-shrink-0 space-y-4">
        <SliderRow label="Width" value={params.width} min={100} max={2000} step={10} onChange={(v) => set('width', v)} />
        <SliderRow label="Height" value={params.height} min={100} max={2000} step={10} onChange={(v) => set('height', v)} />
        <SliderRow label="Quality" value={params.quality} min={1} max={100} onChange={(v) => set('quality', v)} />
        <SliderRow label="Blur" value={params.blur} min={0} max={20} step={0.5} onChange={(v) => set('blur', v)} />

        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <select
            value={params.format}
            onChange={(e) => set('format', e.target.value as ImageFormat)}
            className="border rounded h-8 text-sm px-2 w-full bg-background"
          >
            {(['webp', 'avif', 'jpg', 'png'] as ImageFormat[]).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Fit</Label>
          <select
            value={params.fit}
            onChange={(e) => set('fit', e.target.value as FitMode)}
            className="border rounded h-8 text-sm px-2 w-full bg-background"
          >
            {(['cover', 'contain', 'fill', 'inside', 'outside'] as FitMode[]).map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="grayscale-toggle"
            type="checkbox"
            checked={params.grayscale}
            onChange={(e) => set('grayscale', e.target.checked)}
            className="h-4 w-4 rounded accent-primary"
          />
          <label htmlFor="grayscale-toggle" className="text-sm cursor-pointer">Grayscale</label>
        </div>

        <Button size="sm" variant="outline" className="w-full gap-1" onClick={copyUrl}>
          <Copy className="h-3.5 w-3.5" /> Copy URL
        </Button>
      </div>

      {/* Preview */}
      <div className="flex-1 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Preview</span>
            {sizeLoading && (
              <RefreshCw className="h-3 w-3 text-muted-foreground animate-spin" />
            )}
            {!sizeLoading && fileSize != null && (
              <Badge variant="outline" className="text-xs">{formatBytes(fileSize)}</Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {params.width} × {params.height}
          </span>
        </div>

        <div
          className={cn(
            'border rounded-md overflow-hidden bg-muted/20 flex items-center justify-center',
            'min-h-[200px]'
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={previewUrl}
            src={previewUrl}
            alt="Transform preview"
            className="max-w-full max-h-[500px] object-contain"
          />
        </div>

        <p className="text-[10px] text-muted-foreground font-mono break-all">{previewUrl}</p>
      </div>
    </div>
  )
}
