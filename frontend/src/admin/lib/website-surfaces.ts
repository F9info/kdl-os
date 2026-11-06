import type { WebsiteDelivery } from '@/admin/lib/project-type'

// The surfaces (cards) on the Content > Brands screen. Which ones show follows what the owner chose
// and what is enabled, so a static-only project does not see the live Web app card and a project
// without the Landing module does not see Landing Pages.
export type SurfaceKey = 'webapp' | 'landing' | 'forms' | 'collateral' | 'static'

export function visibleSurfaces(opts: {
  delivery: WebsiteDelivery | null | undefined
  landingEnabled: boolean
  formsEnabled: boolean
}): SurfaceKey[] {
  const { delivery, landingEnabled, formsEnabled } = opts
  const keys: SurfaceKey[] = []
  if (delivery !== 'static') keys.push('webapp') // unset keeps everything visible (existing installs)
  if (landingEnabled) keys.push('landing')
  if (formsEnabled) keys.push('forms')
  keys.push('collateral')
  if (delivery !== 'web-app') keys.push('static')
  return keys
}
