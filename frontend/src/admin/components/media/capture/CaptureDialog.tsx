'use client'

// KDL Phase D8 — capture dialog: opens Webcam / Screen / Voice capture widgets
// from the media library toolbar.

import { useState } from 'react'
import { X, Camera, Monitor, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { WebcamCapture } from './WebcamCapture'
import { ScreenCapture } from './ScreenCapture'
import { VoiceRecorder } from './VoiceRecorder'
import type { CaptureWidgetProps } from './captureUtils'

type CaptureMode = 'webcam' | 'screen' | 'voice'

export interface CaptureDialogProps extends CaptureWidgetProps {
  onClose: () => void
}

export function CaptureDialog({ folderId, onUploaded, onClose }: CaptureDialogProps) {
  const [mode, setMode] = useState<CaptureMode>('webcam')

  const tabs: { id: CaptureMode; label: string; icon: React.ReactNode }[] = [
    { id: 'webcam', label: 'Webcam', icon: <Camera className="h-4 w-4" /> },
    { id: 'screen', label: 'Screen', icon: <Monitor className="h-4 w-4" /> },
    { id: 'voice', label: 'Voice', icon: <Mic className="h-4 w-4" /> },
  ]

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-label="Capture media"
    >
      <div className="bg-background rounded-lg shadow-xl p-6 w-[560px] max-w-[95vw] max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg">Capture media</h3>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex border-b">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMode(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm transition-colors',
                mode === t.id
                  ? 'border-b-2 border-primary text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* key ensures device streams are fully torn down when switching tabs */}
        {mode === 'webcam' && (
          <WebcamCapture key="webcam" folderId={folderId} onUploaded={onUploaded} />
        )}
        {mode === 'screen' && (
          <ScreenCapture key="screen" folderId={folderId} onUploaded={onUploaded} />
        )}
        {mode === 'voice' && (
          <VoiceRecorder key="voice" folderId={folderId} onUploaded={onUploaded} />
        )}
      </div>
    </div>
  )
}
