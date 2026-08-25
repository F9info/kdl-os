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

// Registers an uploaded font file (from MediaPicker) as a usable font-family
// via a dynamic @font-face, so its preview tile renders in the real face
// instead of falling back to sans-serif. Idempotent per family name.
export function loadCustomFontFace(family: string, url: string): void {
  const key = `upload:${family}`
  if (loadedFamilies.has(key) || typeof document === 'undefined') return
  loadedFamilies.add(key)

  const style = document.createElement('style')
  style.textContent = `@font-face { font-family: '${family.replace(/'/g, "\\'")}'; src: url('${url}'); font-display: swap; }`
  document.head.appendChild(style)
}
