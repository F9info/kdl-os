import { cn } from '@/lib/utils'

// KDL-210 — every content image goes through AppImage so it always carries the
// Theme Engine's Images-pane class. compileTokens slugifies the item name
// ("thumbnail-image" → .thumbnail_image), so the class here uses underscores
// even though the admin UI shows the hyphenated name. The classes are emitted
// inside per-device @media blocks in <style id="th-tokens"> (appended to
// <head> at runtime, i.e. after the Tailwind stylesheet), so their
// width/height/object-fit win specificity ties against utility classes —
// callers should not pass w-*/h-*/object-* utilities; max-w-*/max-h-* ceilings
// compose fine and are welcome.
export type AppImageSize =
  'thumbnail' | 'avatar' | 'card' | 'banner' | 'gallery' | 'logo' | 'content' | 'icon'

interface AppImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  size: AppImageSize
  alt: string
}

export function AppImage({ size, className, alt, ...rest }: AppImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cn(`${size}_image`, className)} alt={alt} {...rest} />
  )
}
