'use client'

import { useState } from 'react'
import api from '@/lib/axios'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'

interface ImageUploadFieldProps {
  /** Stored value: a storage path, /path or URL. Empty = not set. */
  value: string
  onChange: (value: string) => void
  /** Identity field this image is for (`logo_light`, `favicon`, ...); also the test id `upload-<name>`. */
  name: string
  emptyText: string
  setText?: string
  /**
   * Show a thumbnail box. Pass the saved value's preview URL ('' when there is none); a file
   * uploaded here shows its own preview straight away. Leave undefined for the compact text form.
   */
  previewUrl?: string
  /**
   * The picture used while `value` is empty (the project's own image, for a per-page override). It
   * is shown in the thumbnail box, so the user sees what they would get by leaving the field empty.
   */
  inheritedUrl?: string
  /** Draw the thumbnail on a dark tile: for a picture made for dark backgrounds (a white logo). */
  darkBackground?: boolean
  /** Called with true while a file is uploading, so the form can hold its Save button. */
  onBusyChange?: (busy: boolean) => void
}

/**
 * Upload / replace / remove for one image, through the identity upload endpoint (images only, 2 MB
 * max, needs settings:edit). The saved value is the storage path the endpoint returns.
 */
export function ImageUploadField({
  value,
  onChange,
  name,
  emptyText,
  setText = 'Custom image set',
  previewUrl,
  inheritedUrl,
  darkBackground = false,
  onBusyChange,
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false)
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [error, setError] = useState<unknown>(null)

  async function upload(file: File) {
    setUploading(true)
    onBusyChange?.(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      // asset=<name>: the company logo goes through the brand kit (see backend identity service).
      const res = await api.post('/identity/upload', body, { params: { asset: name } })
      const { path, url } = res.data.data as { path: string; url?: string }
      setUploadedUrl(url ?? '')
      onChange(path)
    } catch (err) {
      setError(err)
    } finally {
      setUploading(false)
      onBusyChange?.(false)
    }
  }

  const shown = value ? uploadedUrl || previewUrl || '' : (inheritedUrl ?? '')

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {(previewUrl !== undefined || inheritedUrl !== undefined) && (
          <div
            className={`flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded border ${darkBackground ? 'bg-slate-800' : 'bg-muted'}`}
          >
            {shown ? (
              // eslint-disable-next-line @next/next/no-img-element -- presigned storage URL
              <img
                src={shown}
                alt={`${name} preview`}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <span className="text-xs text-muted-foreground">None</span>
            )}
          </div>
        )}
        <span className="text-sm text-muted-foreground">{value ? setText : emptyText}</span>
        <label className="inline-flex">
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            data-testid={`upload-${name}`}
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void upload(file)
              e.target.value = ''
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-accent">
            {uploading ? 'Uploading…' : value ? 'Replace' : 'Upload'}
          </span>
        </label>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setUploadedUrl('')
              onChange('')
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {error ? <ErrorAlert error={error} /> : null}
    </div>
  )
}
