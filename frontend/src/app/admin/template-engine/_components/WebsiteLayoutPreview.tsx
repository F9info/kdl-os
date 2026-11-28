'use client'

import type { ReactNode } from 'react'
import { construction } from '@/frontend/blocks/packs/construction'
import { f9tech } from '@/frontend/blocks/packs/f9tech'
import { LayoutPreview } from '@/admin/components/layouts/LayoutPreview'
import { useCustomSlotNode } from '@/admin/hooks/useLayoutChrome'
import { RenderBlock } from '@/admin/components/shared/RenderBlock'
import { useSiteLayout } from '@/admin/hooks/useSiteLayout'
import { useWebsiteBrandContext } from '@/admin/hooks/useWebsiteBrandContext'
import {
  footerOverrides,
  headerFooterOverrides,
  topHeaderOverrides,
} from '@/admin/lib/website-layout-overrides'

// Same non-null cast/rationale as website/layout/page.tsx's TOP_HEADER_CONFIG
// et al — Puck's own PuckComponent type requires a `puck` field these
// components don't actually read.
type BlockRender = (props: Record<string, unknown>) => ReactNode
const TOP_HEADER_CONFIG = construction.components.ConstructionTopBar!
const HEADER_CONFIG = construction.components.ConstructionHeader!
const FOOTER_CONFIG = construction.components.ConstructionFooter!
const F9_HEADER = f9tech.components.F9Header!
const F9_FOOTER = f9tech.components.F9Footer!

// A quick "what does my site actually look like" preview on the Layout
// settings card — the real Header/Top Header/Footer a project has picked
// (via the Layout picker), shrunk down, with a dummy "Your custom layout"
// placeholder standing in for the page content in between. That middle
// placeholder is decorative only — it never ships to a real page, unlike
// the Header/Footer/Top Header renders either side of it.
export function WebsiteLayoutPreview({ projectId }: { projectId: string }) {
  const brand = useWebsiteBrandContext(projectId)
  const { selection } = useSiteLayout(projectId)

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
          {selection.header.variant.startsWith('landing:') ? (
            <LayoutPreview
              projectId={projectId}
              kind="HEADER"
              variant={selection.header.variant}
              config={selection.header.config}
              scale={1}
            />
          ) : selection.header.variant === 'f9' ? (
            <RenderBlock
              key="f9-header"
              render={F9_HEADER.render as BlockRender}
              props={{
                ...F9_HEADER.defaultProps,
                ...selection.header.config,
                puck: { isEditing: true, metadata: { projectId } },
              }}
            />
          ) : (
            (customHeader ?? (
              <RenderBlock
                key="construction-header"
                render={headerRender}
                props={{
                  ...HEADER_CONFIG.defaultProps,
                  ...headerFooterOverrides(brand),
                  variant: selection.header.variant,
                  puck: { isEditing: true, metadata: { projectId } },
                }}
              />
            ))
          )}
        </div>
      )}
      <div className="flex items-center justify-center bg-muted/30 py-12 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Your custom layout
      </div>
      {selection.footer.enabled && (
        <div style={{ zoom: 0.6 }}>
          {selection.footer.variant.startsWith('landing:') ? (
            <LayoutPreview
              projectId={projectId}
              kind="FOOTER"
              variant={selection.footer.variant}
              config={selection.footer.config}
              scale={1}
            />
          ) : selection.footer.variant === 'f9' ? (
            <RenderBlock
              key="f9-footer"
              render={F9_FOOTER.render as BlockRender}
              props={{
                ...F9_FOOTER.defaultProps,
                ...selection.footer.config,
                puck: { isEditing: true, metadata: { projectId } },
              }}
            />
          ) : (
            (customFooter ?? (
              <RenderBlock
                key="construction-footer"
                render={footerRender}
                props={{
                  ...FOOTER_CONFIG.defaultProps,
                  ...footerOverrides(brand),
                  variant: selection.footer.variant,
                  puck: { isEditing: true, metadata: { projectId } },
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}
