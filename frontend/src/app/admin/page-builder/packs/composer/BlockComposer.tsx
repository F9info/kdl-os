'use client'

import { createPortal } from 'react-dom'
import { ComposerCanvas } from './ComposerCanvas'
import type { CustomBlockRecord } from './custom-blocks-store'

/**
 * Portal-overlay entry point for the ONE case that must stay in-place: editing
 * the config already sitting inside a `CustomComposedBlock` instance on the
 * current Puck page (`skipPersist`, blocks-panel.tsx's "Edit in Composer").
 * That flow needs a live `usePuck()` dispatch to write straight back into the
 * same instance — routing away and back would lose that context. Building a
 * brand NEW section (Insert-a-block modal's "Create new") is a real full
 * page instead: `/admin/page-builder/section-builder`, which renders the
 * same `ComposerCanvas` without this portal.
 *
 * Portaled to <body>: Puck's own `_PuckLayout-inner` sets
 * `position:relative; z-index:0`, which creates a stacking context that
 * traps any `fixed` descendant below the admin shell's own sticky header
 * regardless of z-index value — a full-bleed top bar (ComposerCanvas's) is
 * the first UI in this app to actually collide with it pixel-wise.
 */
export function BlockComposer(props: {
  projectId: string
  categoryKey: string
  editing?: CustomBlockRecord
  skipPersist?: boolean
  onClose: () => void
  onSaved: (block: CustomBlockRecord) => void
}) {
  return createPortal(
    <div className="fixed inset-0 z-[2100]">
      <ComposerCanvas {...props} />
    </div>,
    document.body
  )
}
