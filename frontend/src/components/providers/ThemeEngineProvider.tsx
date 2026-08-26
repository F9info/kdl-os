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

function applyResolvedTheme(activeTheme: ActiveTheme) {
  document.documentElement.setAttribute('data-theme', resolveTheme(activeTheme))
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

// This Next.js app IS the admin panel — its own chrome (sidebar, etc.) must
// consume the `webapp_admin` platform's compiled tokens, not `webapp` (the
// public-facing site, a separate consumer that fetches this same endpoint
// with platform=webapp itself). Native clients (tv/android/ios) likewise
// fetch this endpoint with their own `platform` and apply the JSON form.
async function fetchAndApply(): Promise<ActiveTheme> {
  const res = await api.get<TokensResponse>('/theme-engine/tokens', {
    params: { platform: 'webapp_admin' },
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
