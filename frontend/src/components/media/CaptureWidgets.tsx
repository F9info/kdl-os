'use client'

// Phase D8 — webcam / screen-capture / voice-recorder upload widgets.
// Pure frontend: MediaRecorder + getUserMedia/getDisplayMedia produce a Blob,
// which is handed to the caller's normal upload flow. No backend work.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Video, Monitor, Mic, Square, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/shared/Modal'
import { cn } from '@/lib/utils'

type RecordState = 'idle' | 'starting' | 'recording' | 'preview'

interface CaptureButtonProps {
  onCapture: (file: File) => void
  disabled?: boolean
}

function pickMimeType(candidates: string[]): string {
  if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
    const supported = candidates.find((c) => MediaRecorder.isTypeSupported(c))
    if (supported) return supported
  }
  return candidates[0] ?? ''
}

function extFromMime(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'mp4'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'webm'
}

interface RecorderConfig {
  acquireStream: () => Promise<MediaStream>
  mimeCandidates: string[]
  filenamePrefix: string
  hasVideo: boolean
}

function useCaptureRecorder({ acquireStream, mimeCandidates, filenamePrefix, hasVideo }: RecorderConfig) {
  const [state, setState] = useState<RecordState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileRef = useRef<File | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const stopStreamTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setState('starting')
    try {
      const stream = await acquireStream()
      streamRef.current = stream
      if (hasVideo && videoRef.current) {
        videoRef.current.srcObject = stream
        void videoRef.current.play().catch(() => {})
      }
      const mimeType = pickMimeType(mimeCandidates)
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const ext = extFromMime(mimeType)
        const file = new File([blob], `${filenamePrefix}-${Date.now()}.${ext}`, { type: mimeType })
        fileRef.current = file
        setPreviewUrl(URL.createObjectURL(blob))
        setState('preview')
        stopStreamTracks()
      }
      recorderRef.current = recorder
      recorder.start()
      setState('recording')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not access device')
      setState('idle')
      stopStreamTracks()
    }
  }, [acquireStream, mimeCandidates, filenamePrefix, hasVideo, stopStreamTracks])

  const stop = useCallback(() => {
    recorderRef.current?.stop()
  }, [])

  const reset = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    fileRef.current = null
    setState('idle')
    setError(null)
    stopStreamTracks()
  }, [stopStreamTracks])

  useEffect(() => stopStreamTracks, [stopStreamTracks])

  return { state, error, previewUrl, videoRef, start, stop, reset, getFile: () => fileRef.current }
}

function CaptureModal({
  open,
  onClose,
  title,
  icon,
  hasVideo,
  isAudioOnly,
  onCapture,
  config,
}: {
  open: boolean
  onClose: () => void
  title: string
  icon: React.ReactNode
  hasVideo: boolean
  isAudioOnly: boolean
  onCapture: (file: File) => void
  config: RecorderConfig
}) {
  const rec = useCaptureRecorder(config)

  const handleClose = () => {
    rec.reset()
    onClose()
  }

  const handleUse = () => {
    const file = rec.getFile()
    if (file) onCapture(file)
    rec.reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} title={title} size="md">
      <div className="space-y-4 py-2">
        {rec.error && <p className="text-sm text-destructive" role="alert">{rec.error}</p>}

        {hasVideo && (
          <video
            ref={rec.videoRef}
            muted
            playsInline
            className={cn('w-full rounded-md bg-muted aspect-video', rec.state !== 'recording' && rec.state !== 'starting' && 'hidden')}
          />
        )}

        {isAudioOnly && rec.state === 'recording' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="recording-indicator">
            <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse" /> Recording audio…
          </div>
        )}

        {rec.state === 'preview' && rec.previewUrl && (
          isAudioOnly
            ? <audio controls src={rec.previewUrl} className="w-full" data-testid="capture-preview" />
            : <video controls src={rec.previewUrl} className="w-full rounded-md" data-testid="capture-preview" />
        )}

        <div className="flex gap-2 justify-end">
          {rec.state === 'idle' && (
            <Button onClick={rec.start}>
              {icon}
              Start
            </Button>
          )}
          {(rec.state === 'starting') && (
            <Button disabled>Starting…</Button>
          )}
          {rec.state === 'recording' && (
            <Button variant="destructive" onClick={rec.stop}>
              <Square className="h-4 w-4 mr-1" /> Stop
            </Button>
          )}
          {rec.state === 'preview' && (
            <>
              <Button variant="outline" onClick={rec.reset}>Retake</Button>
              <Button onClick={handleUse}>Use recording</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function useModalOpen() {
  const [open, setOpen] = useState(false)
  return { open, openModal: () => setOpen(true), close: () => setOpen(false) }
}

export function WebcamCaptureButton({ onCapture, disabled }: CaptureButtonProps) {
  const { open, openModal, close } = useModalOpen()
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className={cn(
          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Record from webcam"
      >
        <Video className="h-4 w-4" /> Webcam
      </button>
      <CaptureModal
        open={open}
        onClose={close}
        title="Record from webcam"
        icon={<Video className="h-4 w-4 mr-1" />}
        hasVideo
        isAudioOnly={false}
        onCapture={onCapture}
        config={{
          acquireStream: () => navigator.mediaDevices.getUserMedia({ video: true, audio: true }),
          mimeCandidates: ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
          filenamePrefix: 'webcam',
          hasVideo: true,
        }}
      />
    </>
  )
}

export function ScreenCaptureButton({ onCapture, disabled }: CaptureButtonProps) {
  const { open, openModal, close } = useModalOpen()
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className={cn(
          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Record screen"
      >
        <Monitor className="h-4 w-4" /> Screen
      </button>
      <CaptureModal
        open={open}
        onClose={close}
        title="Record screen"
        icon={<Monitor className="h-4 w-4 mr-1" />}
        hasVideo
        isAudioOnly={false}
        onCapture={onCapture}
        config={{
          acquireStream: () => navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }),
          mimeCandidates: ['video/webm;codecs=vp9,opus', 'video/webm', 'video/mp4'],
          filenamePrefix: 'screen-capture',
          hasVideo: true,
        }}
      />
    </>
  )
}

export function VoiceRecorderButton({ onCapture, disabled }: CaptureButtonProps) {
  const { open, openModal, close } = useModalOpen()
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={openModal}
        className={cn(
          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Record voice"
      >
        <Mic className="h-4 w-4" /> Voice
      </button>
      <CaptureModal
        open={open}
        onClose={close}
        title="Record voice"
        icon={<Mic className="h-4 w-4 mr-1" />}
        hasVideo={false}
        isAudioOnly
        onCapture={onCapture}
        config={{
          acquireStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
          mimeCandidates: ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'],
          filenamePrefix: 'voice-recording',
          hasVideo: false,
        }}
      />
    </>
  )
}
