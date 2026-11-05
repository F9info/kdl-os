'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ModuleGuard } from '@/admin/components/shared/ModuleGuard'
import { SimpleThemeView } from './SimpleThemeView'
import { AdvancedThemeEditor } from './advanced/AdvancedThemeEditor'
import { LS_PLATFORM, LS_VIEW, lsGet, lsSet } from './advanced/constants'

// One Themes screen for both surfaces: the public website and this admin app.
const SURFACES = [
  { id: 'webapp', label: 'Website' },
  { id: 'webapp_admin', label: 'Admin app' },
] as const

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
  const [surface, setSurfaceState] = useState<string>(() => {
    const saved = lsGet(LS_PLATFORM, 'webapp')
    return SURFACES.some((x) => x.id === saved) ? saved : 'webapp'
  })
  const setSurface = (id: string) => {
    setSurfaceState(id)
    lsSet(LS_PLATFORM, id)
  }
  const advanced = view === 'advanced'
  return (
    <ModuleGuard slug="theme-engine">
      <div
        className={advanced ? 'flex flex-col' : undefined}
        style={advanced ? { height: ADVANCED_HEIGHT } : undefined}
      >
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-3 sm:px-6">
          <div className="flex gap-1" role="group" aria-label="Theme surface">
            {SURFACES.map((x) => (
              <Button
                key={x.id}
                size="sm"
                variant={surface === x.id ? 'default' : 'outline'}
                aria-pressed={surface === x.id}
                data-testid={`surface-${x.id}`}
                onClick={() => setSurface(x.id)}
              >
                {x.label}
              </Button>
            ))}
          </div>
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
        {advanced ? (
          <AdvancedThemeEditor key={surface} />
        ) : (
          <SimpleThemeView key={surface} platform={surface} />
        )}
      </div>
    </ModuleGuard>
  )
}
