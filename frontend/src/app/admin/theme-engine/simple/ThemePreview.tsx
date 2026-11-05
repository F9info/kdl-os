'use client'

// The "See" card of the Simple Theme view: real page-builder blocks styled by
// the UNSAVED draft. The draft reaches the blocks only as inline CSS custom
// properties on one wrapper (the ones tailwind.config.ts colour tokens read),
// so nothing here touches the global theme tag the admin panel itself uses.

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { paletteToCssVars, readableOn, type Palette } from './palette'
import { PreviewBoundary } from './PreviewBoundary'
import { PREVIEW_CANVAS_WIDTH, PREVIEW_PACKS } from './preview-packs'

const LS_PACK = 'te_simple_preview_pack'
// Used until the card has been measured.
const DEFAULT_SCALE = 0.7

function readPack(): string {
  try {
    const saved = window.localStorage.getItem(LS_PACK)
    if (PREVIEW_PACKS.some((p) => p.key === saved)) return saved as string
  } catch {
    // storage unavailable (private mode, blocked): fall through to the default
  }
  return PREVIEW_PACKS[0].key
}

function writePack(key: string) {
  try {
    window.localStorage.setItem(LS_PACK, key)
  } catch {
    // remembering the choice is a convenience only
  }
}

// The hand-made mock reads the draft from here so it can also serve as the
// next/dynamic `loading` fallback, which cannot receive props.
const PaletteContext = createContext<Palette | null>(null)

// The text colour the site puts on the main colour (Tailwind `primary-foreground`). It is a
// published token Publish never changes, so the wrapper carries it (see SimpleThemeView's
// baseVars) and the stand-in reads it instead of working one out from the draft.
const ON_PRIMARY = 'var(--buttons_primary_button_text_color, #ffffff)'

// Stand-in shown while the block bundle loads, or if it fails to load.
function MockPreview() {
  const p = useContext(PaletteContext)
  if (!p) return null
  return (
    <div className="space-y-3 p-4" data-testid="simple-theme-preview-mock">
      <div className="rounded-md p-5" style={{ background: p.primary, color: ON_PRIMARY }}>
        <p className="text-lg font-semibold">Welcome to your site</p>
        <p className="text-sm opacity-90">This is how your main colour looks on a hero.</p>
      </div>
      <div className="rounded-md border p-4" style={{ borderColor: `${p.text}22` }}>
        <p className="font-medium">A card with body text</p>
        <p className="text-sm" style={{ color: p.text, opacity: 0.75 }}>
          Normal text sits on your page background.
        </p>
        <div className="mt-3 flex gap-2">
          <span
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ background: p.primary, color: ON_PRIMARY }}
          >
            Primary button
          </span>
          <span
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ background: p.secondary, color: readableOn(p.secondary) }}
          >
            Second
          </span>
          <span
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ background: p.accent, color: readableOn(p.accent) }}
          >
            Accent
          </span>
          <span
            className="rounded px-3 py-1.5 text-sm font-medium"
            style={{ background: p.highlight, color: readableOn(p.highlight) }}
          >
            Highlight
          </span>
        </div>
      </div>
    </div>
  )
}

const PreviewBlocks = dynamic(() => import('./PreviewBlocks'), {
  ssr: false,
  loading: () => <MockPreview />,
})

export function ThemePreview({
  palette,
  mode,
  baseVars = {},
  fontVars = {},
}: {
  /** The six quick colours of the current mode, draft included. */
  palette: Palette
  mode: 'light' | 'dark'
  /** Published values of the rest of the pane, as CSS variables (the draft wins over them). */
  baseVars?: Record<string, string>
  /** `--th-typo-*-family` overrides for the fonts to show (see fonts.ts); none keeps the admin's own. */
  fontVars?: Record<string, string>
}) {
  const [packKey, setPackKey] = useState(readPack)
  const pack = PREVIEW_PACKS.find((p) => p.key === packKey) ?? PREVIEW_PACKS[0]
  const [scale, setScale] = useState(DEFAULT_SCALE)
  const viewport = useRef<HTMLDivElement>(null)

  // Blocks are laid out PREVIEW_CANVAS_WIDTH wide and scaled to the card.
  useEffect(() => {
    const el = viewport.current
    if (!el) return
    const fit = () => {
      if (el.clientWidth > 0) setScale(Math.min(1, el.clientWidth / PREVIEW_CANVAS_WIDTH))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const style = {
    ...baseVars,
    ...paletteToCssVars(palette),
    ...fontVars,
    ...(fontVars['--th-typo-body-family']
      ? { fontFamily: 'var(--th-typo-body-family), ui-sans-serif, system-ui, sans-serif' }
      : {}),
    background: palette.background,
    color: palette.text,
    colorScheme: mode,
  } as CSSProperties

  return (
    <PaletteContext.Provider value={palette}>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview with">
        <span className="text-xs text-muted-foreground">Preview with:</span>
        {PREVIEW_PACKS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={p.key === pack.key ? 'default' : 'outline'}
            aria-pressed={p.key === pack.key}
            onClick={() => {
              setPackKey(p.key)
              writePack(p.key)
            }}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div
        className="overflow-hidden rounded-md border border-border"
        style={style}
        data-testid="simple-theme-preview"
      >
        <div
          ref={viewport}
          role="region"
          aria-label="Theme preview"
          // a scrollable region must be reachable by keyboard (WCAG 2.1.1)
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          tabIndex={0}
          className="max-h-[34rem] overflow-y-auto overflow-x-hidden"
        >
          <PreviewBoundary key={pack.key} fallback={<MockPreview />}>
            <PreviewBlocks blocks={pack.blocks} scale={scale} />
          </PreviewBoundary>
        </div>
      </div>
    </PaletteContext.Provider>
  )
}
