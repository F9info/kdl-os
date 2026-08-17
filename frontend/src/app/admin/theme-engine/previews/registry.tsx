// ─────────────────────────────────────────────────────────────────────────────
// Device pane preview registry (KDL-202, sub-task 1/3).
//
// Maps a pane's semantic id → the dedicated component preview rendered inside
// the DeviceShell. Panes not listed here fall back to <DefaultShellPreview />
// (see ThemeDevicePreviews.tsx). Integration (KDL-205) imports this as
// `./registry` (extensionless — resolves to registry.tsx).
//
// NB: file is `.tsx`, not `.ts`, because it returns JSX (TS forbids JSX in .ts).
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'
import { PalettePreview, TypographyPreview, type TEPaneLite } from './ThemeDevicePreviews'

export const DEVICE_PANE_PREVIEWS: Record<
  string,
  (ctx: { pane: TEPaneLite; values: Record<string, string> }) => ReactNode
> = {
  branding: (ctx) => <PalettePreview pane={ctx.pane} values={ctx.values} />,
  typography: (ctx) => <TypographyPreview pane={ctx.pane} values={ctx.values} />,
}
