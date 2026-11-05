// ─────────────────────────────────────────────────────────────────────────────
// Nav groups (sidebar categories for native platforms)
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_GROUPS: Record<string, [string, string[]][]> = {
  tv: [
    ['Foundations', ['branding', 'typography', 'layout', 'dimensions']],
    ['Navigation', ['navigation', 'search']],
    [
      'Core Components',
      ['buttons', 'controls', 'forms', 'lists', 'cards', 'tables', 'surfaces', 'icons'],
    ],
    ['Media & Playback', ['details', 'playback', 'images']],
    ['Patterns', ['popup', 'progress', 'recommendations', 'alerts', 'emptystates', 'onboarding']],
    [
      'Advanced',
      ['accessibility', 'motion', 'gestures', 'assets', 'customcomponents', 'tokens', 'guidelines'],
    ],
    ['TV OS Style Guides', ['androidtv', 'leanback', 'tvos', 'firetv', 'roku', 'tizen', 'webos']],
  ],
  android: [
    ['Design Tokens', ['branding', 'typography', 'tokens']],
    ['Layout', ['layout']],
    ['Navigation', ['appbar', 'tabs', 'bottomnav', 'navigation']],
    ['Inputs & Forms', ['forms']],
    ['Buttons', ['buttons', 'fab']],
    ['Data Display', ['cards', 'tables', 'chips']],
    ['Feedback', ['popup', 'alerts', 'emptystates']],
    ['Onboarding', ['onboarding']],
    ['Media & Assets', ['images', 'assets']],
  ],
  ios: [
    ['Design Tokens', ['branding', 'typography', 'tokens']],
    ['Layout', ['layout']],
    ['Navigation', ['navigation', 'tabbar', 'sidemenu']],
    ['Buttons', ['buttons']],
    ['Forms & Controls', ['forms']],
    ['Data Display', ['cards', 'tables', 'collections']],
    ['Feedback', ['popup', 'alerts', 'emptystates']],
    ['Onboarding', ['onboarding']],
    ['Media & Assets', ['images', 'assets']],
  ],
}

export const PLATFORMS = [
  { id: 'webapp', icon: '🌐', label: 'Web App' },
  { id: 'tv', icon: '📺', label: 'TV' },
  { id: 'android', icon: '🤖', label: 'Android Native App' },
  { id: 'ios', icon: '🍎', label: 'iOS Native App' },
]

export const LS_PLATFORM = 'th_platform'
export const LS_PANE = 'te_pane'
export const LS_VIEW = 'te_view'

export function lsGet(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return localStorage.getItem(key) ?? fallback
}
export function lsSet(key: string, val: string) {
  if (typeof window !== 'undefined') localStorage.setItem(key, val)
}
