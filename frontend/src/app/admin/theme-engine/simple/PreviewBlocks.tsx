'use client'

// The real page-builder blocks for the Simple view's preview. Imported lazily
// (next/dynamic in ThemePreview) because puck.config pulls in every pack, which
// is by far the heaviest thing on this page.
//
// Blocks are rendered the way Puck's own <Render> does (as components, so the
// hooks inside a block keep their own state), with a minimal non-editing
// `puck` context: no inline editing, no drop zones, no project metadata (so a
// block never fetches project data for the preview).

import { memo, type ComponentType } from 'react'
import { config } from '@/app/admin/page-builder/puck.config'
import { PreviewBoundary } from './PreviewBoundary'
import { PREVIEW_CANVAS_WIDTH } from './preview-packs'

type BlockRender = ComponentType<Record<string, unknown>>

const PUCK = { isEditing: false, metadata: {}, dragRef: null, renderDropZone: () => null }

function NoPreview({ name }: { name: string }) {
  return (
    <p className="m-3 rounded border border-dashed border-border p-3 text-xs text-muted-foreground">
      Could not preview {name}.
    </p>
  )
}

function PreviewBlocks({ blocks, scale }: { blocks: readonly string[]; scale: number }) {
  return (
    // `inert`: the blocks are a picture, not a page. Their links must not
    // navigate away from unpublished changes, nor take keyboard focus.
    // (React 18 only passes `inert` through as a plain string attribute, which
    // its types do not allow, hence the cast.)
    <div
      {...({ inert: '' } as object)}
      className="pointer-events-none select-none"
      data-testid="simple-theme-preview-canvas"
      style={{ width: PREVIEW_CANVAS_WIDTH, zoom: scale }}
    >
      {blocks.map((key) => {
        const def = config.components?.[key]
        const Render = def?.render as unknown as BlockRender | undefined
        const name = def?.label ?? key
        return (
          <PreviewBoundary key={key} fallback={<NoPreview name={name} />}>
            {Render ? (
              <Render {...def?.defaultProps} id={`theme-preview-${key}`} puck={PUCK} />
            ) : (
              <NoPreview name={name} />
            )}
          </PreviewBoundary>
        )
      })}
    </div>
  )
}

// The draft colours live in CSS variables on the wrapper, not in props, so the
// blocks themselves never re-render while the user picks a colour.
export default memo(PreviewBlocks)
