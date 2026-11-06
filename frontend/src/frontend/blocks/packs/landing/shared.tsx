import type { CSSProperties } from 'react'
import { fontOf, type FontPair } from './fonts'
import { paletteOf, type Palette } from './palettes'

// Helpers shared by the Landing blocks and their alternative designs (section-variants.tsx).

export type Common = { palette: string; font: string }

export const lines = (raw: string | undefined) =>
  (raw ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

export const rows = (raw: string | undefined, min: number) =>
  lines(raw)
    .map((l) => l.split('|').map((x) => x.trim()))
    .filter((r) => r.length >= min)

export const look = (props: Common) => ({ p: paletteOf(props.palette), f: fontOf(props.font) })

export const display = (f: FontPair): CSSProperties => ({
  fontFamily: f.display,
  fontWeight: f.weight,
  letterSpacing: f.tracking,
})

export function SectionHead({
  eyebrow,
  title,
  subtitle,
  p,
  f,
  light = false,
}: {
  eyebrow?: string
  title: string
  subtitle?: string
  p: Palette
  f: FontPair
  light?: boolean
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && (
        <span
          className="text-xs font-semibold uppercase tracking-[0.18em]"
          style={{ color: light ? p.accent : p.strong }}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className="mt-2 text-3xl leading-tight md:text-5xl"
        style={{ ...display(f), color: light ? '#fff' : '#17112b' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className="mt-4 text-base md:text-lg"
          style={{ color: light ? 'rgba(255,255,255,.75)' : '#5b5675' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}
