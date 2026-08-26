// Injects a Google Fonts stylesheet <link> for the given family, so font
// picker previews (checkbox tiles, "Aa Bb Cc" samples) render in the real
// typeface instead of the browser default. Idempotent — safe to call on
// every render of every tile.
const loadedFamilies = new Set<string>()

export function loadGoogleFont(family: string): void {
  const trimmed = family.trim()
  if (!trimmed || loadedFamilies.has(trimmed) || typeof document === 'undefined') return
  loadedFamilies.add(trimmed)

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(trimmed).replace(/%20/g, '+')}:wght@400;500;600;700&display=swap`
  document.head.appendChild(link)
}

// Registers an uploaded font file (from MediaPicker) as a usable font-family,
// so its preview tile renders in the real face instead of falling back to
// sans-serif. Idempotent per family name.
//
// Uses the FontFace API rather than building an @font-face CSS string —
// `family` comes from an uploaded filename and `url` from a media record,
// neither is safe to interpolate into hand-built CSS text (CSS injection).
// Both are still validated defensively since the `src` descriptor is parsed
// as CSS syntax by FontFace itself.
export function loadCustomFontFace(family: string, url: string): void {
  const key = `upload:${family}`
  if (loadedFamilies.has(key) || typeof document === 'undefined') return
  if (!/^https?:\/\//.test(url) || /['"();\\\n]/.test(url)) return
  loadedFamilies.add(key)

  try {
    const face = new FontFace(family, `url("${url}")`)
    document.fonts.add(face)
    void face.load()
  } catch {
    // Invalid family name or unloadable font file — the tile just falls back to sans-serif.
  }
}
