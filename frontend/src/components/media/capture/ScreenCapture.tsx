'use client'

// KDL Phase D8 — screen capture: getDisplayMedia + MediaRecorder record/stop.
// The recording uploads through the normal /media/upload endpoint.

import { useState, useRef, useEffect } from 'react'
import { MonitorUp, Square } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  uploadCapture,
  extFromMime,
  mediaErrorMessage,
  formatDuration,
  stopStream,
  type CaptureWidgetProps,
} from './captureUtils'

export function ScreenCapture({ folderId, onUploaded }: CaptureWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)

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
    },
    []
  )

  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

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
    const mediaDevices = navigator.mediaDevices as MediaDevices | undefined
    if (!mediaDevices?.getDisplayMedia) {
      setError('Screen capture is not supported in this browser.')
      return
    }
    if (typeof MediaRecorder === 'undefined') {
      setError('Screen recording is not supported in this browser.')
      return
    }
    try {
      const stream = await mediaDevices.getDisplayMedia({ video: true })
      streamRef.current = stream
      const video = videoRef.current
      if (video) {
        try {
          video.srcObject = stream
        } catch {
          /* jsdom */
        }
        video.play?.()?.catch?.(() => {})
      }
      // The browser's own "Stop sharing" bar ends the track without going
      // through our stop() button — without this listener the UI is left
      // stuck showing "Recording" forever even though capture has ended.
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stop())
      chunksRef.current = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const mime = rec.mimeType || 'video/webm'
        const file = new File(
          chunksRef.current,
          `screen-${Date.now()}.${extFromMime(mime, 'webm')}`,
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
      setError(mediaErrorMessage(err, 'screen sharing'))
    }
  }

  const stop = () => {
    setRecording(false)
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
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          data-testid="screen-preview"
          className="w-full aspect-video rounded border bg-black object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stop}>
            <Square className="h-4 w-4 mr-1" /> Stop recording
          </Button>
        ) : (
          <Button size="sm" onClick={start} disabled={uploading}>
            <MonitorUp className="h-4 w-4 mr-1" /> Start screen recording
          </Button>
        )}
        {recording && (
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="screen-timer">
            {formatDuration(seconds)}
          </span>
        )}
        {uploading && <span className="text-sm text-muted-foreground">Uploading…</span>}
      </div>
    </div>
  )
}
