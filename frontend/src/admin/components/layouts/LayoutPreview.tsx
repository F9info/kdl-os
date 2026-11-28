'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { construction } from '@/frontend/blocks/packs/construction'
import { f9tech } from '@/frontend/blocks/packs/f9tech'
import { landing } from '@/frontend/blocks/packs/landing'
import { RenderBlock } from '@/admin/components/shared/RenderBlock'
import { useCustomSlotNode } from '@/admin/hooks/useLayoutChrome'
import { useWebsiteBrandContext } from '@/admin/hooks/useWebsiteBrandContext'
import type { LayoutKind } from '@/admin/hooks/useLayoutLibrary'
import {
  footerOverrides,
  headerFooterOverrides,
  topHeaderOverrides,
  type SectionVariant,
} from '@/admin/lib/website-layout-overrides'

type BlockRender = (props: Record<string, unknown>) => ReactNode

const BUILT_IN = {
  TOP_HEADER: construction.components.ConstructionTopBar!,
  HEADER: construction.components.ConstructionHeader!,
  FOOTER: construction.components.ConstructionFooter!,
}
const F9 = { HEADER: f9tech.components.F9Header!, FOOTER: f9tech.components.F9Footer! }
const LANDING = {
  HEADER: landing.components.LandingHeader!,
  FOOTER: landing.components.LandingFooter!,
}
const CATEGORY = { TOP_HEADER: 'top-bar', HEADER: 'header', FOOTER: 'footer' } as const

/**
 * A layout drawn the way the live site draws it: a built-in design with the project's brand, menu and
 * identity, the F9 Tech blocks with the layout's own settings, or a saved Section Builder block.
 * `scale` shrinks it (CSS zoom resizes the layout box too, so no height guess is needed).
 */
export function LayoutPreview({
  projectId,
  kind,
  variant,
  config,
  scale = 0.55,
  fitWidth,
}: {
  projectId: string
  kind: LayoutKind
  variant: string
  config?: Record<string, string>
  scale?: number
  /** Draw the design at this width (e.g. 1280, a desktop) and shrink it to fill its container. Overrides `scale`. */
  fitWidth?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(1)
  useEffect(() => {
    if (!fitWidth || !box.current) return
    const el = box.current
    const update = () => setFit(el.clientWidth / fitWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fitWidth])

  const brand = useWebsiteBrandContext(projectId)
  const custom = useCustomSlotNode(projectId, CATEGORY[kind], variant as SectionVariant)
  const puck = { isEditing: true, metadata: { projectId } }

  let body: ReactNode = null
  if (variant === 'f9') {
    const def = kind === 'HEADER' || kind === 'FOOTER' ? F9[kind] : null
    if (def) {
      body = (
        <RenderBlock
          key="f9"
          render={def.render as BlockRender}
          props={{ ...def.defaultProps, ...config, puck }}
        />
      )
    }
  } else if (/^landing:[1-4]$/.test(variant)) {
    const def = kind === 'HEADER' || kind === 'FOOTER' ? LANDING[kind] : null
    if (def) {
      body = (
        <RenderBlock
          key={variant}
          render={def.render as BlockRender}
          props={{ ...def.defaultProps, ...config, variant: variant.slice(8), puck }}
        />
      )
    }
  } else if (variant.startsWith('custom:')) {
    body = custom
  } else {
    const def = BUILT_IN[kind]
    const overrides =
      kind === 'TOP_HEADER'
        ? topHeaderOverrides(brand)
        : kind === 'HEADER'
          ? headerFooterOverrides(brand)
          : footerOverrides(brand)
    body = (
      <RenderBlock
        key={`built-in-${variant}`}
        render={def.render as BlockRender}
        props={{ ...def.defaultProps, ...overrides, variant, puck }}
      />
    )
  }

  if (!body) {
    return (
      <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
        No preview for this design
      </div>
    )
  }
  if (fitWidth) {
    return (
      <div
        ref={box}
        className="pointer-events-none w-full overflow-hidden bg-white"
        aria-hidden="true"
      >
        <div style={{ width: fitWidth, zoom: fit }}>{body}</div>
      </div>
    )
  }
  return (
    <div
      className="pointer-events-none overflow-hidden bg-white"
      style={{ zoom: scale }}
      aria-hidden="true"
    >
      {body}
    </div>
  )
}
