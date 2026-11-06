'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { SimpleThemeView } from './SimpleThemeView'
import { AdvancedThemeEditor } from './advanced/AdvancedThemeEditor'
import { LS_VIEW, lsGet, lsSet } from './advanced/constants'

// The Themes screen themes this admin app only (website colours are under Frontend).
const SURFACE = 'webapp_admin'

// Advanced is a fixed-height "app window": the viewport minus what the admin shell reserves around
// the page (header, footer and page padding, all Theme Engine Layout tokens). The height is set
// here, on one column that holds the Simple/Advanced bar AND the editor, so the editor flexes into
// what the bar leaves and its Save/Reset footer is never pushed below the fold. Simple just scrolls.
const ADVANCED_HEIGHT =
  'calc(100dvh - var(--th-layout-header-height, 60px) - var(--th-layout-footer-height, 48px) - 2 * var(--th-layout-page-padding, 1.5rem))'

// Simple/Advanced switch. The Advanced editor lives in ./advanced/.
export default function ThemeEnginePage() {
  const [view, setViewState] = useState(() => lsGet(LS_VIEW, 'simple'))
  const setView = (v: 'simple' | 'advanced') => {
    setViewState(v)
    lsSet(LS_VIEW, v)
  }
  const advanced = view === 'advanced'
  return (
    <ModuleGuard slug="theme-engine">
      <div
        className={advanced ? 'flex flex-col' : undefined}
        style={advanced ? { height: ADVANCED_HEIGHT } : undefined}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-6">
          <div className="flex gap-1" role="group" aria-label="Theme view">
            {(['simple', 'advanced'] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? 'default' : 'outline'}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v === 'simple' ? 'Simple' : 'Advanced'}
              </Button>
            ))}
          </div>
        </div>
        {advanced ? <AdvancedThemeEditor /> : <SimpleThemeView platform={SURFACE} />}
      </div>
    </ModuleGuard>
  )
}
