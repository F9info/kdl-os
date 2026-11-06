'use client'

import { useEffect, useRef } from 'react'
import api from '@/lib/axios'

const STYLE_TAG_ID = 'th-tokens'
const REFRESH_EVENT = 'th-tokens-refresh'

type ActiveTheme = 'dark' | 'light' | 'system'

interface TokensResponse {
  success: boolean
  data: { css: string; json: unknown; activeTheme?: ActiveTheme }
}

function resolveTheme(activeTheme: ActiveTheme): 'dark' | 'light' {
  if (activeTheme !== 'system') return activeTheme
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// The Theme Engine decides light or dark for the whole app. `data-theme` drives its own token CSS;
// the `dark` class drives Tailwind's `dark:` variants and the `.dark` rules in the stylesheets, so
// both are set from the same resolved value. Left to the OS, a dark OS with a light Active Theme
// gave a light screen with dark-mode logos and buttons on it (white logo on white, dark outline
// button with dark text).
export function applyResolvedTheme(activeTheme: ActiveTheme) {
  const resolved = resolveTheme(activeTheme)
  const root = document.documentElement
  root.setAttribute('data-theme', resolved)
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
}

function injectCss(css: string) {
  let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = STYLE_TAG_ID
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = css
}

// Which platform's compiled tokens this app consumes. The admin panel keeps
// `webapp_admin`; a generated client site (template-engine/site/generator.js
// writes NEXT_PUBLIC_THEME_PLATFORM=webapp into its .env.local) consumes the
// same `webapp` theme the Theme Engine "Web App" tab edits — so the Studio
// preview matches what gets exported (export manifest: site.themeEndpoint).
const THEME_PLATFORM = process.env.NEXT_PUBLIC_THEME_PLATFORM || 'webapp_admin'

// This Next.js app IS the admin panel — its own chrome (sidebar, etc.) must
// consume the `webapp_admin` platform's compiled tokens, not `webapp` (the
// public-facing site, a separate consumer that fetches this same endpoint
// with platform=webapp itself). Native clients (tv/android/ios) likewise
// fetch this endpoint with their own `platform` and apply the JSON form.
async function fetchAndApply(): Promise<ActiveTheme> {
  const res = await api.get<TokensResponse>('/theme-engine/tokens', {
    params: { platform: THEME_PLATFORM },
  })
  const { css, activeTheme } = res.data.data
  injectCss(css)
  return activeTheme ?? 'system'
}

/**
 * Applies Theme Engine tokens at runtime: injects the compiled
 * `webapp_admin` CSS custom properties into `<style id="th-tokens">` and sets
 * `data-theme` from the saved Active Theme (or the OS preference when
 * "system"). The Theme Engine admin page calls `refreshThemeEngineTokens()`
 * after a save so the change is visible without a hard reload.
 */
export function ThemeEngineProvider({ children }: { children: React.ReactNode }) {
  const activeThemeRef = useRef<ActiveTheme>('system')

  useEffect(() => {
    // A static website (Convert to Static Website) has its theme baked in as /th-tokens.css and has no
    // server to ask: only the light/dark choice is applied here, from the value saved at conversion.
    if (process.env.NEXT_PUBLIC_STATIC_SITE === '1') {
      const baked = (process.env.NEXT_PUBLIC_THEME_ACTIVE as ActiveTheme | undefined) ?? 'system'
      activeThemeRef.current = baked
      applyResolvedTheme(baked)
      const mq = window.matchMedia('(prefers-color-scheme: light)')
      const onChange = () => {
        if (baked === 'system') applyResolvedTheme('system')
      }
      mq.addEventListener('change', onChange)
      return () => mq.removeEventListener('change', onChange)
    }

    let cancelled = false

    const load = async () => {
      try {
        const activeTheme = await fetchAndApply()
        if (cancelled) return
        activeThemeRef.current = activeTheme
        applyResolvedTheme(activeTheme)
      } catch {
        // Tokens unavailable (offline, first boot before seeding) — the app
        // keeps its static globals.css defaults.
      }
    }
    void load()

    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onSystemChange = () => {
      if (activeThemeRef.current === 'system') applyResolvedTheme('system')
    }
    mq.addEventListener('change', onSystemChange)

    const onRefresh = () => void load()
    window.addEventListener(REFRESH_EVENT, onRefresh)

    return () => {
      cancelled = true
      mq.removeEventListener('change', onSystemChange)
      window.removeEventListener(REFRESH_EVENT, onRefresh)
    }
  }, [])

  return <>{children}</>
}

/** Ask the provider to re-fetch and re-apply tokens (call after a save). */
export function refreshThemeEngineTokens() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REFRESH_EVENT))
}
