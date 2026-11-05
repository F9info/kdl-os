'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
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

interface Props {
  mediaId: string
  mediaSrc: string
  open: boolean
  onClose: () => void
  onJobStarted: (jobId: string) => void
}

type VideoPreset = '1080p' | '720p' | '480p' | '360p'
type VideoFormat = 'mp4' | 'webm'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 10)
  return `${m}:${s.toString().padStart(2, '0')}.${ms}`
}

export function VideoTrimDialog({ mediaId, mediaSrc, open, onClose, onJobStarted }: Props) {
  const [duration, setDuration] = useState(60)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(60)
  const [trimLoading, setTrimLoading] = useState(false)

  const [preset, setPreset] = useState<VideoPreset>('720p')
  const [format, setFormat] = useState<VideoFormat>('mp4')
  const [transcodeLoading, setTranscodeLoading] = useState(false)

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const dur = e.currentTarget.duration
    if (isFinite(dur) && dur > 0) {
      setDuration(dur)
      setEnd(dur)
    }
  }

  const handleTrim = async () => {
    setTrimLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/video-op`, {
        op: 'trim',
        start,
        end,
      })
      const jobId = res.data.data.job_id
      onJobStarted(jobId)
      toast({ title: 'Trim job started', description: jobId })
      onClose()
    } catch {
      toast({ title: 'Trim failed', variant: 'destructive' })
    } finally {
      setTrimLoading(false)
    }
  }

  const handleTranscode = async () => {
    setTranscodeLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/video-op`, {
        op: 'transcode',
        preset,
        format,
      })
      const jobId = res.data.data.job_id
      onJobStarted(jobId)
      toast({ title: 'Transcode job started', description: jobId })
      onClose()
    } catch {
      toast({ title: 'Transcode failed', variant: 'destructive' })
    } finally {
      setTranscodeLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Video Tools</DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 min-h-0 space-y-6 pr-1">
          {/* Video preview */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={mediaSrc}
            controls
            className="w-full rounded border bg-black"
            onLoadedMetadata={handleLoadedMetadata}
          />

          {/* Trim */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Trim</h3>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>Start</Label>
                <span className="text-muted-foreground font-mono">{formatTime(start)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={start}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setStart(Math.min(v, end - 0.1))
                }}
                className="w-full"
              />
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <Label>End</Label>
                <span className="text-muted-foreground font-mono">{formatTime(end)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={end}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  setEnd(Math.max(v, start + 0.1))
                }}
                className="w-full"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Clip duration: <span className="font-mono">{formatTime(end - start)}</span>
            </p>

            <Button size="sm" onClick={handleTrim} disabled={trimLoading}>
              {trimLoading ? 'Starting…' : 'Trim'}
            </Button>
          </div>

          {/* Transcode */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold border-b pb-1">Transcode</h3>

            <div className="space-y-1">
              <Label className="text-xs">Preset</Label>
              <Select value={preset} onValueChange={(v) => setPreset(v as VideoPreset)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['1080p', '720p', '480p', '360p'] as VideoPreset[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Format</Label>
              <Select value={format} onValueChange={(v) => setFormat(v as VideoFormat)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['mp4', 'webm'] as VideoFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" onClick={handleTranscode} disabled={transcodeLoading}>
              {transcodeLoading ? 'Starting…' : 'Transcode'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
