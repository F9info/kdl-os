// The Website (Brands) stage page remembers which view was open in localStorage
// (see WebsiteStage: key `te-website-ui:<projectId>`). The CMS sidebar entries use this to
// open the right view: "Brands" = the brand cards, "Layouts" = the layout settings, "Navigation" = the menu editor, "Pages" = the Web app pages grid.
export function openWebsiteView(
  projectId: string,
  view: 'brands' | 'layouts' | 'pages' | 'navigation'
) {
  try {
    window.localStorage.setItem(
      `te-website-ui:${projectId}`,
      JSON.stringify(
        view === 'pages'
          ? { openBrand: 'webapp', webAppStep: 'assemble' }
          : view === 'layouts'
            ? { openBrand: 'webapp', webAppStep: 'layouts' }
            : view === 'navigation'
              ? { openBrand: 'webapp', webAppStep: 'navigation' }
              : { openBrand: null, webAppStep: 'typography' }
      )
    )
  } catch {
    // storage unavailable — the page just opens on whatever view it last had
  }
}

// Small helpers for the Web app flow's own in-progress UI state (current step, edits) in localStorage.
export function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // best-effort — a private window or full storage shouldn't break the UI
  }
}
