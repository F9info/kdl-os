'use client'

import type { ReactNode } from 'react'
import { construction } from '@/app/admin/page-builder/packs/construction'
import { useCustomSlotNode } from '@/hooks/useLayoutChrome'
import { useWebsiteBrandContext } from '@/hooks/useWebsiteBrandContext'
import {
  footerOverrides,
  headerFooterOverrides,
  mergeLayoutSelection,
  readLocal,
  topHeaderOverrides,
  websiteLayoutStorageKey,
  type LayoutSelection,
} from '@/lib/website-layout-overrides'

// Same non-null cast/rationale as website/layout/page.tsx's TOP_HEADER_CONFIG
// et al — Puck's own PuckComponent type requires a `puck` field these
// components don't actually read.
type BlockRender = (props: Record<string, unknown>) => ReactNode
const TOP_HEADER_CONFIG = construction.components.ConstructionTopBar!
const HEADER_CONFIG = construction.components.ConstructionHeader!
const FOOTER_CONFIG = construction.components.ConstructionFooter!

// A quick "what does my site actually look like" preview on the Layout
// settings card — the real Header/Top Header/Footer a project has picked
// (via the Layout picker), shrunk down, with a dummy "Your custom layout"
// placeholder standing in for the page content in between. That middle
// placeholder is decorative only — it never ships to a real page, unlike
// the Header/Footer/Top Header renders either side of it.
export function WebsiteLayoutPreview({ projectId }: { projectId: string }) {
  const brand = useWebsiteBrandContext(projectId)
  const stored = readLocal<Partial<LayoutSelection>>(websiteLayoutStorageKey(projectId), {})
  const selection = mergeLayoutSelection(stored)

  const customTop = useCustomSlotNode(projectId, 'top-bar', selection.topHeader.variant)
  const customHeader = useCustomSlotNode(projectId, 'header', selection.header.variant)
  const customFooter = useCustomSlotNode(projectId, 'footer', selection.footer.variant)

  const topHeaderRender = TOP_HEADER_CONFIG.render as BlockRender
  const headerRender = HEADER_CONFIG.render as BlockRender
  const footerRender = FOOTER_CONFIG.render as BlockRender

  if (!selection.topHeader.enabled && !selection.header.enabled && !selection.footer.enabled) {
    return null
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border">
      {selection.topHeader.enabled && (
        <div style={{ zoom: 0.6 }}>
          {customTop ??
            topHeaderRender({
              ...TOP_HEADER_CONFIG.defaultProps,
              ...topHeaderOverrides(brand),
              variant: selection.topHeader.variant,
            })}
        </div>
      )}
      {selection.header.enabled && (
        <div style={{ zoom: 0.6 }}>
          {customHeader ??
            headerRender({
              ...HEADER_CONFIG.defaultProps,
              ...headerFooterOverrides(brand),
              variant: selection.header.variant,
              puck: { isEditing: true, metadata: { projectId } },
            })}
        </div>
      )}
      <div className="flex items-center justify-center bg-muted/30 py-12 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your custom layout
      </div>
      {selection.footer.enabled && (
        <div style={{ zoom: 0.6 }}>
          {customFooter ??
            footerRender({
              ...FOOTER_CONFIG.defaultProps,
              ...footerOverrides(brand),
              variant: selection.footer.variant,
              puck: { isEditing: true, metadata: { projectId } },
            })}
        </div>
      )}
    </div>
  )
}
