'use client'

import { useEffect } from 'react'
import { X, Download } from 'lucide-react'
import type { Media } from '@/types/media.types'
import { usePermissions } from '@/hooks/usePermissions'
import { AppImage } from '@/components/shared/AppImage'

interface MediaLightboxProps {
  item: Media | null
  onClose: () => void
}

// Full-file preview modal — opened by double-clicking a grid/list item or the
// "Preview" action. Renders the actual file (not a thumbnail) for image,
// video, audio, and PDF; falls back to a download link for anything else.
export function MediaLightbox({ item, onClose }: MediaLightboxProps) {
  const { can } = usePermissions()
  useEffect(() => {
    if (!item) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [item, onClose])

  if (!item) return null

  const mime = item.mime_type ?? ''
  const isImage = mime.startsWith('image/')
  const isVideo = mime.startsWith('video/')
  const isAudio = mime.startsWith('audio/')
  const isPdf = mime === 'application/pdf'
  const name = item.title || item.original_name

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex flex-col"
      role="dialog"
      aria-label={`Preview ${name}`}
      aria-modal="true"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stopPropagation wrapper, not interactive */}
      <div className="flex items-center justify-between px-4 py-3 text-white flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        <span className="text-sm truncate">{name}</span>
        <div className="flex items-center gap-2">
          {item.url && can('media:download') && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              download={item.original_name}
              className="p-1.5 rounded hover:bg-white/10"
              title="Download"
            >
              <Download className="h-5 w-5" />
            </a>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- stopPropagation wrapper, not interactive */}
      <div className="flex-1 flex items-center justify-center min-h-0 p-4" onClick={(e) => e.stopPropagation()}>
        {!item.url ? (
          <p className="text-white/70 text-sm">This file has no preview available yet.</p>
        ) : isImage ? (
          <AppImage size="gallery" src={item.url} alt={name} className="max-h-full max-w-full" />
        ) : isVideo ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded content; captions not available
          <video src={item.url} controls autoPlay className="max-h-full max-w-full">
            Your browser cannot play this video.
          </video>
        ) : isAudio ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption -- user-uploaded content; captions not available
          <audio src={item.url} controls className="w-full max-w-xl" />
        ) : isPdf ? (
          <iframe src={item.url} title={name} className="w-full h-full bg-white rounded" />
        ) : (
          <div className="text-center space-y-3 text-white/80">
            <p className="text-sm">No inline preview for this file type ({mime || 'unknown'}).</p>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline text-sm"
            >
              Open in a new tab
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
