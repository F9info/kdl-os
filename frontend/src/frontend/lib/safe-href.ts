// Links typed into a page (button, hero, call to action) end up in href attributes on public pages.
// A `javascript:` or `data:` address would run in the visitor's browser when clicked, so every such
// href goes through here. Browsers ignore tabs, newlines and spaces inside a URL ("java\tscript:"
// still runs), so those are stripped before the scheme is read. Same rule as the page validator's
// LINK_UNSAFE check (backend/src/modules/page-builder/validate.js).
const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function safeHref(url: string | null | undefined, fallback = '#'): string {
  const value = (url ?? '').trim()
  if (!value) return fallback
  const scheme = /^([a-z][a-z0-9+.-]*:)/i.exec(value.replace(/[\u0000- \u007f]/g, ''))
  if (!scheme) return value // "#contact", "/p/page", "page", "?x=1": same-site, no scheme
  return ALLOWED_SCHEMES.has(scheme[1]!.toLowerCase()) ? value : fallback
}
