'use client'

import { useEffect, useState } from 'react'
import { ModuleGuard } from '@/components/shared/ModuleGuard'
import {
  renderComposedBlock,
  DEFAULT_SETTINGS,
  type ComposedBlockConfig,
} from '../../packs/composer/render-composed-block'

/**
 * Opened via `window.open(...)` from the Section Builder's "Preview" button —
 * a separate tab so the plain rendered output can be checked without the
 * editor's selection outlines/toolbars in the way. Reads the config the
 * opener just wrote to sessionStorage rather than a saved block id: nothing
 * here is necessarily saved yet, this previews the in-progress edit itself.
 * `window.open` from the same origin clones the opener's sessionStorage into
 * this new tab at open time, so the value written just before `open()` is
 * already present on first read here — no extra handshake needed.
 */
export default function SectionBuilderPreviewPage() {
  const [config, setConfig] = useState<ComposedBlockConfig | null | 'missing'>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('sb-preview')
    if (!raw) {
      setConfig('missing')
      return
    }
    try {
      setConfig(JSON.parse(raw))
    } catch {
      setConfig('missing')
    }
  }, [])

  return (
    <ModuleGuard slug="page-builder">
      <div className="fixed inset-0 z-[2100] overflow-auto bg-white">
        {config === 'missing' ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Nothing to preview — open this from the Section Builder&apos;s Preview button.
          </div>
        ) : config ? (
          renderComposedBlock({ ...config, settings: config.settings ?? DEFAULT_SETTINGS })
        ) : null}
      </div>
    </ModuleGuard>
  )
}
