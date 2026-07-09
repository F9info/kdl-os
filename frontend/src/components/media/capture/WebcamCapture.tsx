'use client'

// KDL Phase D8 — webcam capture: live preview, photo snap (canvas → JPEG) and
// video recording (MediaRecorder). Captured files upload through /media/upload.

import { useState, useRef, useEffect } from 'react'
import { Camera, Circle, Square } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  uploadCapture, extFromMime, mediaErrorMessage, formatDuration, stopStream,
  type CaptureWidgetProps,
} from './captureUtils'

export function WebcamCapture({ folderId, onUploaded }: CaptureWidgetProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)

  // Acquire camera + mic on mount; stop all tracks on unmount.
  useEffect(() => {
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera capture is not supported in this browser.')
      return
    }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) { stopStream(stream); return }
        streamRef.current = stream
        setReady(true)
        const video = videoRef.current
        if (video) {
          try { video.srcObject = stream } catch { /* jsdom */ }
          video.play?.()?.catch?.(() => {})
        }
      })
      .catch((err: unknown) => setError(mediaErrorMessage(err, 'camera and microphone')))
    return () => {
      cancelled = true
      const rec = recorderRef.current
      if (rec && rec.state !== 'inactive') {
        rec.ondataavailable = null
        rec.onstop = null
        try { rec.stop() } catch { /* already stopped */ }
      }
      recorderRef.current = null
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [])

  // Recording timer
  useEffect(() => {
    if (!recording) return
    const t = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [recording])

  const handleUpload = async (file: File) => {
    setUploading(true)
    try {
      const media = await uploadCapture(file, folderId)
      toast({ title: 'Capture uploaded' })
      onUploaded?.(media)
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' })
    } finally {
      setUploading(false)
    }
  }

  const snapPhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast({ title: 'Could not capture photo', variant: 'destructive' })
      return
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob((blob) => {
      if (!blob) {
        toast({ title: 'Could not capture photo', variant: 'destructive' })
        return
      }
      handleUpload(new File([blob], `webcam-${Date.now()}.jpg`, { type: 'image/jpeg' }))
    }, 'image/jpeg', 0.92)
  }

  const startRecording = () => {
    const stream = streamRef.current
    if (!stream) return
    if (typeof MediaRecorder === 'undefined') {
      setError('Video recording is not supported in this browser.')
      return
    }
    chunksRef.current = []
    const rec = new MediaRecorder(stream)
    rec.ondataavailable = (e: BlobEvent) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.onstop = () => {
      const mime = rec.mimeType || 'video/webm'
      const file = new File(chunksRef.current, `webcam-${Date.now()}.${extFromMime(mime, 'webm')}`, { type: mime })
      chunksRef.current = []
      handleUpload(file)
    }
    recorderRef.current = rec
    rec.start()
    setSeconds(0)
    setRecording(true)
  }

  const stopRecording = () => {
    setRecording(false)
    const rec = recorderRef.current
    recorderRef.current = null
    try { rec?.stop() } catch { /* already stopped */ }
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p role="alert" className="text-sm text-destructive">{error}</p>
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          data-testid="webcam-preview"
          className="w-full aspect-video rounded border bg-black object-cover"
        />
      )}
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={snapPhoto} disabled={!ready || uploading || recording}>
          <Camera className="h-4 w-4 mr-1" /> Take photo
        </Button>
        {recording ? (
          <Button size="sm" variant="destructive" onClick={stopRecording}>
            <Square className="h-4 w-4 mr-1" /> Stop recording
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={startRecording} disabled={!ready || uploading}>
            <Circle className="h-4 w-4 mr-1 text-red-500 fill-current" /> Start recording
          </Button>
        )}
        {recording && (
          <span className="text-sm text-muted-foreground tabular-nums" data-testid="webcam-timer">
            {formatDuration(seconds)}
          </span>
        )}
        {uploading && <span className="text-sm text-muted-foreground">Uploading…</span>}
      </div>
    </div>
  )
}
