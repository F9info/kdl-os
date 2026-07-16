// B3 — Responsive image component with avif/webp srcsets and lazy loading
// Widths: 400 | 800 | 1200 | 1600  ·  Falls back to jpg@800 for the <img> src

import { AppImage, type AppImageSize } from '@/components/shared/AppImage'

interface MediaImageProps {
  id: string
  className?: string
  alt?: string
  width?: number
  height?: number
  /** Template Engine Images-pane class; rendered size obeys those tokens. */
  size?: AppImageSize
}

const WIDTHS = [400, 800, 1200, 1600] as const

const SIZES = '(max-width: 400px) 400px, (max-width: 800px) 800px, (max-width: 1200px) 1200px, 1600px'

function tUrl(id: string, w: number, format: string) {
  return `/api/media/${id}/t?w=${w}&format=${format}`
}

function srcset(id: string, format: string) {
  return WIDTHS.map((w) => `${tUrl(id, w, format)} ${w}w`).join(', ')
}

export function MediaImage({ id, className, alt = '', width, height, size = 'content' }: MediaImageProps) {
  return (
    <picture>
      <source type="image/avif" srcSet={srcset(id, 'avif')} sizes={SIZES} />
      <source type="image/webp" srcSet={srcset(id, 'webp')} sizes={SIZES} />
      <AppImage
        size={size}
        src={`/api/media/${id}/t?w=800&format=jpg`}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        className={className}
      />
    </picture>
  )
}
