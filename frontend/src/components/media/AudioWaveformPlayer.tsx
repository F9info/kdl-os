'use client'

import { useEffect, useRef, useState } from 'react'
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
}

type AudioFormat = 'mp3' | 'wav' | 'aac' | 'ogg' | 'flac'

interface JobResult {
  waveform_url?: string
  peaks?: number[]
}

interface JobStatusResponse {
  data: {
    state: string
    result: JobResult | null
  }
}

export function AudioWaveformPlayer({ mediaId, mediaSrc }: Props) {
  const [waveformUrl, setWaveformUrl] = useState<string | null>(null)
  const [peaks, setPeaks] = useState<number[]>([])
  const [waveformJobId, setWaveformJobId] = useState<string | null>(null)
  const [waveformLoading, setWaveformLoading] = useState(false)

  const [normalizeLoading, setNormalizeLoading] = useState(false)

  const [convertFormat, setConvertFormat] = useState<AudioFormat>('mp3')
  const [convertLoading, setConvertLoading] = useState(false)

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current)
      }
    }
  }, [])

  const stopPoll = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const startPolling = (jobId: string) => {
    stopPoll()
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<JobStatusResponse>(`/media/jobs/${jobId}`)
        const { state, result } = res.data.data
        if (state === 'completed') {
          stopPoll()
          setWaveformLoading(false)
          if (result?.waveform_url) setWaveformUrl(result.waveform_url)
          if (result?.peaks && result.peaks.length > 0) setPeaks(result.peaks)
        } else if (state === 'failed') {
          stopPoll()
          setWaveformLoading(false)
          toast({ title: 'Waveform generation failed', variant: 'destructive' })
        }
      } catch {
        stopPoll()
        setWaveformLoading(false)
        toast({ title: 'Failed to poll job status', variant: 'destructive' })
      }
    }, 2000)
  }

  const handleGenerateWaveform = async () => {
    setWaveformLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/audio-op`, {
        op: 'waveform',
      })
      const jobId = res.data.data.job_id
      setWaveformJobId(jobId)
      toast({ title: 'Waveform generation started' })
      startPolling(jobId)
    } catch {
      setWaveformLoading(false)
      toast({ title: 'Failed to start waveform job', variant: 'destructive' })
    }
  }

  const handleNormalize = async () => {
    setNormalizeLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/audio-op`, {
        op: 'normalize',
      })
      toast({ title: 'Normalize job started', description: res.data.data.job_id })
    } catch {
      toast({ title: 'Normalize failed', variant: 'destructive' })
    } finally {
      setNormalizeLoading(false)
    }
  }

  const handleConvert = async () => {
    setConvertLoading(true)
    try {
      const res = await api.post<{ data: { job_id: string } }>(`/media/${mediaId}/audio-op`, {
        op: 'convert',
        format: convertFormat,
      })
      toast({ title: 'Convert job started', description: res.data.data.job_id })
    } catch {
      toast({ title: 'Convert failed', variant: 'destructive' })
    } finally {
      setConvertLoading(false)
    }
  }

  const maxPeak = peaks.reduce((acc, p) => Math.max(acc, p), 1)

  return (
    <div className="space-y-5 p-4">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio src={mediaSrc} controls className="w-full" />

      {/* Waveform */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold border-b pb-1">Waveform</h3>
        <Button size="sm" onClick={handleGenerateWaveform} disabled={waveformLoading}>
          {waveformLoading ? 'Generating…' : 'Generate Waveform'}
        </Button>
        {waveformJobId !== null && waveformLoading && (
          <p className="text-xs text-muted-foreground">
            Job: <span className="font-mono">{waveformJobId}</span>
          </p>
        )}
        {waveformUrl !== null && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={waveformUrl} alt="Audio waveform" className="w-full rounded border" />
        )}
        {peaks.length > 0 && (
          <svg
            viewBox={`0 0 ${peaks.length} 100`}
            className="w-full h-16 rounded border bg-muted/20"
            preserveAspectRatio="none"
            aria-label="Audio peaks visualization"
          >
            {peaks.map((peak, i) => {
              const h = (peak / maxPeak) * 90
              const y = (100 - h) / 2
              return (
                <rect
                  key={i}
                  x={i}
                  y={y}
                  width={0.8}
                  height={h}
                  className="fill-primary opacity-70"
                />
              )
            })}
          </svg>
        )}
      </div>

      {/* Normalize */}
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-sm font-semibold">Normalize</h3>
        <Button size="sm" onClick={handleNormalize} disabled={normalizeLoading}>
          {normalizeLoading ? 'Starting…' : 'Normalize'}
        </Button>
      </div>

      {/* Convert */}
      <div className="space-y-3 border-t pt-4">
        <h3 className="text-sm font-semibold">Convert Format</h3>
        <div className="space-y-1">
          <Label className="text-xs">Target format</Label>
          <Select value={convertFormat} onValueChange={(v) => setConvertFormat(v as AudioFormat)}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['mp3', 'wav', 'aac', 'ogg', 'flac'] as AudioFormat[]).map((f) => (
                <SelectItem key={f} value={f}>
                  {f.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleConvert} disabled={convertLoading}>
          {convertLoading ? 'Starting…' : 'Convert'}
        </Button>
      </div>
    </div>
  )
}
