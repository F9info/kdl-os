// ─────────────────────────────────────────────────────────────────────────────
// DeviceShell — outer device chrome per platform (KDL-202, sub-task 1/3).
//
// Ports the prototype's `deviceFrame()` (theme-engine.html lines 1663–1671)
// and its `.dev-phone`/`.dev-tv`/`.dev-browser` chrome (lines 130–153). The
// outer sizes/classes are kept 1:1 with page.tsx's existing `PreviewFrame`
// (lines 465–518) — this replaces the empty inner `<div>` with real `children`
// rendered inside the screen area, WITHOUT redesigning the chrome dimensions.
// ─────────────────────────────────────────────────────────────────────────────

import type { ReactNode } from 'react'

/** Screen wrapper — a flex column so app-shell children stretch to the edges,
 *  mirroring the prototype's `.dev-screen { display:flex; flex-direction:column }`. */
function Screen({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  )
}

/** True when the device id or label indicates landscape orientation.
 *  Prototype uses `_h` suffixes (phone_h, tablet_h, ipad_h, laptop_h) and
 *  `↔` in the label to denote horizontal/landscape variants. */
function isLandscape(device: string | undefined): boolean {
  if (!device) return false
  return device.endsWith('_h') || device.includes('↔') || device.includes('landscape')
}

export function DeviceShell({
  platform,
  device,
  children,
}: {
  platform: string
  device?: string
  children: ReactNode
}): JSX.Element {
  const landscape = isLandscape(device)

  if (platform === 'tv') {
    return (
      <div className="flex flex-col items-center gap-0">
        <div className="w-[280px] overflow-hidden rounded-[8px] border-[7px] border-[#0b0b0c] bg-black shadow-[0_14px_40px_rgba(0,0,0,.5)]">
          <Screen className="min-h-[158px] bg-[#0d0d0f]">{children}</Screen>
        </div>
        <div
          className="h-3.5 w-16 bg-[#0b0b0c]"
          style={{ clipPath: 'polygon(22% 0, 78% 0, 100% 100%, 0 100%)' }}
        />
        <div className="h-1 w-32 rounded-sm bg-[#141416]" />
      </div>
    )
  }

  if (platform === 'android') {
    if (landscape) {
      // Landscape: phone rotated — wider, shorter, nav bar moves to side
      return (
        <div className="flex flex-row">
          <div className="h-[190px] w-[340px] overflow-hidden rounded-[20px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
            <div className="flex h-full flex-row">
              <Screen className="flex-1 bg-card">{children}</Screen>
              <div className="flex flex-col justify-around bg-[#0b0b0c] px-1.5 py-6 text-xs text-[#9a9aa2]">
                <span>◁</span>
                <span>○</span>
                <span>▢</span>
              </div>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col">
        <div className="w-[240px] overflow-hidden rounded-[28px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
          <Screen className="min-h-[420px] bg-card">{children}</Screen>
          <div className="flex justify-around bg-[#0b0b0c] px-10 py-2 text-xs text-[#9a9aa2]">
            <span>◁</span>
            <span>○</span>
            <span>▢</span>
          </div>
        </div>
      </div>
    )
  }

  if (platform === 'ios') {
    if (landscape) {
      // Landscape: phone rotated — wider, shorter, notch moves to side
      return (
        <div className="h-[190px] w-[340px] overflow-hidden rounded-[20px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
          <div className="flex h-full flex-row">
            <div className="flex flex-col justify-center bg-black px-1 py-6">
              <span className="h-16 w-2.5 rounded-full border border-[#232325] bg-[#0b0b0c]" />
            </div>
            <Screen className="flex-1 bg-card">{children}</Screen>
          </div>
        </div>
      )
    }
    return (
      <div className="w-[240px] overflow-hidden rounded-[28px] border-[8px] border-[#0b0b0c] shadow-[0_16px_44px_rgba(0,0,0,.5)]">
        <div className="flex justify-center bg-black py-1.5">
          <span className="h-3 w-20 rounded-full border border-[#232325] bg-[#0b0b0c]" />
        </div>
        <Screen className="min-h-[420px] bg-card">{children}</Screen>
      </div>
    )
  }

  // webapp → browser frame; landscape = wider, shorter (laptop_h, tablet_h, mobile_h)
  if (landscape) {
    return (
      <div className="w-[380px] overflow-hidden rounded-[8px] border border-border shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
          <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
          <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
          <span className="h-2 w-2 rounded-full bg-[#28c840]" />
          <span className="ml-1.5 flex-1 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
            app.kdl.dev
          </span>
        </div>
        <Screen className="min-h-[160px] bg-card">{children}</Screen>
      </div>
    )
  }

  return (
    <div className="w-[280px] overflow-hidden rounded-[8px] border border-border shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-border bg-muted px-2 py-1.5">
        <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
        <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
        <span className="h-2 w-2 rounded-full bg-[#28c840]" />
        <span className="ml-1.5 flex-1 rounded bg-background px-2 py-0.5 text-[10px] text-muted-foreground">
          app.kdl.dev
        </span>
      </div>
      <Screen className="min-h-[220px] bg-card">{children}</Screen>
    </div>
  )
}
