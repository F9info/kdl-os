// KDL Phase D8 — shared helpers for the capture widgets (webcam / screen / voice).
// Uploads go through the same normal upload endpoint the media page uses:
// POST /media/upload with FormData field "files" (+ optional folder_id).

import api from '@/lib/axios'
import type { Media } from '@/types/media.types'

/** Derive a file extension from a MediaRecorder mimeType (may carry codecs). */
export function extFromMime(mime: string, fallback = 'webm'): string {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? ''
  const map: Record<string, string> = {
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'video/x-matroska': 'mkv',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/wav': 'wav',
    'image/jpeg': 'jpg',
    'image/png': 'png',
  }
  return map[base] ?? base.split('/')[1] ?? fallback
}

/** Upload a captured File through the normal media upload endpoint. */
export async function uploadCapture(
  file: File,
  folderId?: string | null
): Promise<Media | undefined> {
  const fd = new FormData()
  fd.append('files', file)
  if (folderId) fd.append('folder_id', folderId)
  const res = await api.post('/media/upload', fd)
  const d = res.data?.data as { media?: Media | Media[] } | undefined
  if (!d) return undefined
  return Array.isArray(d.media) ? d.media[0] : d.media
}

/** Friendly message for getUserMedia/getDisplayMedia failures. */
export function mediaErrorMessage(err: unknown, device: string): string {
  const name = (err as { name?: string } | null)?.name
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return `Permission denied — please allow ${device} access in your browser and try again.`
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return `No ${device} was found on this device.`
  }
  return `Could not access the ${device}.`
}

/** 65 → "1:05" */
export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Stop every track on a stream (safe on null). */
export function stopStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((t) => t.stop())
}

export interface CaptureWidgetProps {
  folderId?: string | null
  onUploaded?: (media?: Media) => void
}
