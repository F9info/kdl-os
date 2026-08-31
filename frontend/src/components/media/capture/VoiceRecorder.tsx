'use client'

// KDL Phase D8 — voice recorder: getUserMedia({audio}) + MediaRecorder with a
// simple level/timer display. Recordings upload through /media/upload.

import { useState, useRef, useEffect } from 'react'
import { Mic, Square } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  uploadCapture,
  extFromMime,
  mediaErrorMessage,
  formatDuration,
  stopStream,
  type CaptureWidgetProps,
} from './captureUtils'

export function VoiceRecorder({ folderId, onUploaded }: CaptureWidgetProps) {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0) // 0..1
  const [uploading, setUploading] = useState(false)

  const teardownLevelMeter = () => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current)
      levelTimerRef.current = null
    }
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    setLevel(0)
  }

  // Stop everything on unmount
  useEffect(
    () => () => {
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.ondataavailable = null
        rec.onstop = null
        try {
          rec.stop()
        } catch {
          /* already stopped */
        }
      }
      recorderRef.current = null
      stopStream(streamRef.current)
      streamRef.current = null
      if (levelTimerRef.current) clearInterval(levelTimerRef.current)
      audioCtxRef.current?.close().catch(() => {})
      audioCtxRef.current = null
    },
    []
  )

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  // Best-effort input level meter (skipped where AudioContext is unavailable, e.g. jsdom)
  const setupLevelMeter = (stream: MediaStream) => {
    try {
      const Ctx =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = ctx
      const data = new Uint8Array(analyser.frequencyBinCount)
      levelTimerRef.current = setInterval(() => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
        setLevel(peak)
      }, 100)
    } catch {
      /* level meter is cosmetic */
    }
  }

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const media = await uploadCapture(file, folderId)
      toast({ title: 'Recording uploaded' })
      onUploaded?.(media)
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const start = async () => {
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Audio capture is not supported in this browser.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('Audio recording is not supported in this browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setupLevelMeter(stream)
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const mime = rec.mimeType || 'audio/webm'
        const file = new File(
          chunksRef.current,
          `voice-${Date.now()}.${extFromMime(mime, 'webm')}`,
          { type: mime }
        )
        chunksRef.current = []
        stopStream(streamRef.current)
        streamRef.current = null
        handleUpload(file)
      }
      recorderRef.current = rec
      rec.start()
      setSeconds(0)
      setRecording(true)
    } catch (err: unknown) {
      setError(mediaErrorMessage(err, 'microphone'))
    }
  }

  const stop = () => {
    setRecording(false)
    teardownLevelMeter()
    const rec = recorderRef.current
    recorderRef.current = null
    try {
      rec?.stop()
    } catch {
      /* already stopped */
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {recording && (
        <div className="flex items-center gap-3">
          <Mic className="h-5 w-5 text-red-500 animate-pulse" />
          {/* Level meter */}
          <div
            className="flex-1 h-2 bg-muted rounded-full overflow-hidden"
            data-testid="voice-level"
          >
            <div
              className={cn('h-full bg-red-500 rounded-full transition-all duration-100')}
              style={{ width: `${Math.max(4, Math.round(level * 100))}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="voice-timer">
            {formatDuration(seconds)}
          </span>
        </div>
      )}
      <div className="flex items-center gap-2">
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-4 w-4" /> Stop recording
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={uploading}>
            <Mic className="h-4 w-4" /> Start voice recording
          </Button>
        )}
        {uploading && <span className="text-sm text-muted-foreground">Uploading…</span>}
      </div>
    </div>
  )
}
