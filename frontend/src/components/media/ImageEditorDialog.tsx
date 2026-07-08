'use client'

import { useState, type ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import api from '@/lib/axios'
import { ChevronDown, ChevronRight, X } from 'lucide-react'
import type { ImageOp, WatermarkPosition } from '@/types/processing.types'

interface Props {
  mediaId: string
  mediaUrl: string
  open: boolean
  onClose: () => void
  onSaved: (jobId: string) => void
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(true)
  return (
    <div className="border rounded-md overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full px-3 py-2 bg-muted/40 text-sm font-medium hover:bg-muted/60"
        onClick={() => setExpanded((v) => !v)}
      >
        {title}
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {expanded && <div className="p-3 space-y-2">{children}</div>}
    </div>
  )
}

function opLabel(op: ImageOp): string {
  switch (op.op) {
    case 'resize':
      return `resize ${op.width ?? '?'}×${op.height ?? '?'} (${op.fit ?? 'cover'})`
    case 'rotate':
      return `rotate ${op.angle}°`
    case 'crop':
      return `crop ${op.width}×${op.height}`
    case 'flip':
      return 'flip vertical'
    case 'flop':
      return 'flop horizontal'
    case 'brightness':
      return `brightness ${op.factor.toFixed(2)}`
    case 'contrast':
      return `contrast ${op.factor.toFixed(2)}`
    case 'saturation':
      return `saturation ${op.factor.toFixed(2)}`
    case 'grayscale':
      return 'grayscale'
    case 'blur':
      return `blur${op.sigma !== undefined ? ` σ=${op.sigma}` : ''}`
    case 'sharpen':
      return 'sharpen'
    case 'negate':
      return 'negate'
    case 'text_watermark':
      return `watermark "${op.text}"`
    case 'logo_watermark':
      return `logo watermark`
    case 'compress':
      return `compress q=${op.quality ?? 80} ${op.format ?? 'jpeg'}`
  }
}

const WATERMARK_POSITIONS: WatermarkPosition[] = [
  'top-left',
  'top-center',
  'top-right',
  'center',
  'bottom-left',
  'bottom-center',
  'bottom-right',
]

type ResizeFit = 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
type CompressFormat = 'jpeg' | 'webp' | 'avif' | 'png'

export function ImageEditorDialog({ mediaId, mediaUrl, open, onClose, onSaved }: Props) {
  const [ops, setOps] = useState<ImageOp[]>([])
  const [saving, setSaving] = useState(false)

  // Transform
  const [resizeWidth, setResizeWidth] = useState('')
  const [resizeHeight, setResizeHeight] = useState('')
  const [resizeFit, setResizeFit] = useState<ResizeFit>('cover')
  const [rotateAngle, setRotateAngle] = useState('')

  // Adjustments
  const [brightness, setBrightness] = useState(1)
  const [contrast, setContrast] = useState(1)
  const [saturation, setSaturation] = useState(1)

  // Filters
  const [blurSigma, setBlurSigma] = useState('')

  // Watermark
  const [wmText, setWmText] = useState('')
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>('bottom-right')

  // Compress
  const [compressQuality, setCompressQuality] = useState(80)
  const [compressFormat, setCompressFormat] = useState<CompressFormat>('jpeg')

  const addOp = (op: ImageOp) => setOps((prev) => [...prev, op])
  const removeOp = (idx: number) => setOps((prev) => prev.filter((_, i) => i !== idx))

  const handleSave = async () => {
    if (ops.length === 0) {
      toast({ title: 'Add at least one operation first', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/edit`, { ops })
      const jobId = res.data.data.job_id
      onSaved(jobId)
      toast({ title: `Edit job started: ${jobId}` })
      setOps([])
      onClose()
    } catch {
      toast({ title: 'Failed to start edit job', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Edit Image</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Preview + ops queue */}
          <div className="w-48 flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt="Current image preview"
              className="w-full rounded border object-contain max-h-40"
            />
            {ops.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">
                  Queue ({ops.length})
                </p>
                {ops.map((op, i) => (
                  <Badge
                    key={i}
                    variant="secondary"
                    className="text-xs flex items-center justify-between gap-1 w-full py-1"
                  >
                    <span className="truncate">{opLabel(op)}</span>
                    <button type="button" onClick={() => removeOp(i)} className="flex-shrink-0 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar sections */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {/* Transform */}
            <Section title="Transform">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resize</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Width"
                    value={resizeWidth}
                    onChange={(e) => setResizeWidth(e.target.value)}
                    className="h-8 text-sm"
                  />
                  <span className="text-muted-foreground text-xs">×</span>
                  <Input
                    type="number"
                    placeholder="Height"
                    value={resizeHeight}
                    onChange={(e) => setResizeHeight(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Select value={resizeFit} onValueChange={(v) => setResizeFit(v as ResizeFit)}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['cover', 'contain', 'fill', 'inside', 'outside'] as ResizeFit[]).map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const w = resizeWidth ? parseInt(resizeWidth, 10) : undefined
                    const h = resizeHeight ? parseInt(resizeHeight, 10) : undefined
                    if (!w && !h) return
                    addOp({ op: 'resize', width: w, height: h, fit: resizeFit })
                  }}
                >
                  Add resize
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Rotate</p>
                <Input
                  type="number"
                  placeholder="Angle (degrees)"
                  value={rotateAngle}
                  onChange={(e) => setRotateAngle(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const angle = parseFloat(rotateAngle)
                    if (isNaN(angle)) return
                    addOp({ op: 'rotate', angle })
                    setRotateAngle('')
                  }}
                >
                  Add rotate
                </Button>
              </div>

              <div className="flex gap-2 pt-2 border-t">
                <Button size="sm" variant="outline" onClick={() => addOp({ op: 'flip' })}>
                  Flip vertical
                </Button>
                <Button size="sm" variant="outline" onClick={() => addOp({ op: 'flop' })}>
                  Flop horizontal
                </Button>
              </div>
            </Section>

            {/* Adjustments */}
            <Section title="Adjustments">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Brightness</Label>
                  <span className="text-muted-foreground">{brightness.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={brightness}
                  onChange={(e) => setBrightness(parseFloat(e.target.value))}
                  className="w-full"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => addOp({ op: 'brightness', factor: brightness })}
                >
                  Add brightness
                </Button>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between text-xs">
                  <Label>Contrast</Label>
                  <span className="text-muted-foreground">{contrast.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={contrast}
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="w-full"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => addOp({ op: 'contrast', factor: contrast })}
                >
                  Add contrast
                </Button>
              </div>

              <div className="space-y-1 pt-2 border-t">
                <div className="flex justify-between text-xs">
                  <Label>Saturation</Label>
                  <span className="text-muted-foreground">{saturation.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={0.05}
                  value={saturation}
                  onChange={(e) => setSaturation(parseFloat(e.target.value))}
                  className="w-full"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => addOp({ op: 'saturation', factor: saturation })}
                >
                  Add saturation
                </Button>
              </div>
            </Section>

            {/* Filters */}
            <Section title="Filters">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => addOp({ op: 'grayscale' })}>
                  Grayscale
                </Button>
                <Button size="sm" variant="outline" onClick={() => addOp({ op: 'sharpen' })}>
                  Sharpen
                </Button>
                <Button size="sm" variant="outline" onClick={() => addOp({ op: 'negate' })}>
                  Negate
                </Button>
              </div>
              <div className="space-y-1 pt-2 border-t">
                <Label className="text-xs">Blur sigma (optional)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 2"
                  value={blurSigma}
                  onChange={(e) => setBlurSigma(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const sigma = blurSigma ? parseFloat(blurSigma) : undefined
                    addOp({ op: 'blur', sigma })
                    setBlurSigma('')
                  }}
                >
                  Add blur
                </Button>
              </div>
            </Section>

            {/* Watermark */}
            <Section title="Watermark">
              <Input
                placeholder="Watermark text"
                value={wmText}
                onChange={(e) => setWmText(e.target.value)}
                className="h-8 text-sm"
              />
              <Select value={wmPosition} onValueChange={(v) => setWmPosition(v as WatermarkPosition)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WATERMARK_POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!wmText.trim()) return
                  addOp({ op: 'text_watermark', text: wmText, position: wmPosition })
                  setWmText('')
                }}
              >
                Add watermark
              </Button>
            </Section>

            {/* Compress */}
            <Section title="Compress">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <Label>Quality</Label>
                  <span className="text-muted-foreground">{compressQuality}</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={1}
                  value={compressQuality}
                  onChange={(e) => setCompressQuality(parseInt(e.target.value, 10))}
                  className="w-full"
                />
              </div>
              <Select value={compressFormat} onValueChange={(v) => setCompressFormat(v as CompressFormat)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['jpeg', 'webp', 'avif', 'png'] as CompressFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  addOp({ op: 'compress', quality: compressQuality, format: compressFormat })
                }
              >
                Add compress
              </Button>
            </Section>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || ops.length === 0}>
            {saving ? 'Saving…' : `Save (${ops.length} op${ops.length !== 1 ? 's' : ''})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
