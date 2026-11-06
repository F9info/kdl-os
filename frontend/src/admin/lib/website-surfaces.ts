// The cards on the Frontend > Brands screen. There are only a few: the Web app (its pages, menus and
// forms, with "Convert to Static Website" inside it), Landing Pages when that module is on, and
// Collateral. Forms and the static export are parts of the Web app, not cards of their own.
export type SurfaceKey = 'webapp' | 'landing' | 'collateral'

export function visibleSurfaces(opts: { landingEnabled: boolean }): SurfaceKey[] {
  const keys: SurfaceKey[] = ['webapp']
  if (opts.landingEnabled) keys.push('landing')
  keys.push('collateral')
  return keys
}
