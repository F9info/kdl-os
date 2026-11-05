import { DeviceShell } from '../previews/DeviceShell'
import { DefaultShellPreview } from '../previews/ThemeDevicePreviews'
import { DEVICE_PANE_PREVIEWS } from '../previews/registry'
import { COMPONENT_PANE_PREVIEWS } from '../previews/componentRegistry'
import type { TEPane } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Device frame previews
// ─────────────────────────────────────────────────────────────────────────────

export function PreviewFrame({
  platform,
  pane,
  values,
  device,
}: {
  platform: string
  pane: TEPane | undefined
  values: Record<string, string>
  device?: string
}) {
  const renderer = pane
    ? { ...DEVICE_PANE_PREVIEWS, ...COMPONENT_PANE_PREVIEWS }[pane.id]
    : undefined
  return (
    <DeviceShell platform={platform} device={device}>
      {renderer && pane ? renderer({ pane, values }) : <DefaultShellPreview platform={platform} />}
    </DeviceShell>
  )
}
