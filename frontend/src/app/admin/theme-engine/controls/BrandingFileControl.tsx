'use client'

import { useState } from 'react'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MediaPicker } from '@/components/shared/MediaPicker'
import { cn } from '@/lib/utils'
import type { Media } from '@/types/media.types'

// Branding & Assets `file` fields store a plain string (the media URL). Default
// is ''. This mirrors the prototype `.filectl` control: a thumbnail (when the
// value looks like an image), the filename or a "Choose file…" placeholder, an
// upload trigger that opens the shared MediaPicker, and a Remove action.

const IMAGE_URL_RE = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?.*)?$/i

function looksLikeImage(url: string): boolean {
  return IMAGE_URL_RE.test(url.trim())
}

function fileName(url: string): string {
  const clean = url.split(/[?#]/)[0] ?? url
  const base = clean.split('/').pop() ?? clean
  return base || url
}

export function BrandingFileControl({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const hasValue = value.trim().length > 0

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-2"
        title="Choose file"
      >
        {hasValue && looksLikeImage(value) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-6 w-6 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-border/50 text-muted-foreground">
            <Upload className="h-3.5 w-3.5" />
          </span>
        )}
        <span className={cn('max-w-[200px] truncate', !hasValue && 'text-muted-foreground')}>
          {hasValue ? fileName(value) : 'Choose file…'}
        </span>
      </Button>

      {hasValue && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange('')}
          className="gap-1 text-muted-foreground hover:text-destructive"
          title="Remove file"
        >
          <X className="h-3 w-3" />
          Remove
        </Button>
      )}

      {open && (
        <MediaPicker
          open
          onClose={() => setOpen(false)}
          onSelect={(media: Media[]) => {
            const url = media[0]?.url
            if (url) onChange(url)
            setOpen(false)
          }}
        />
      )}
    </span>
  )
}
