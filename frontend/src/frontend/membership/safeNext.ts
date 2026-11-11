/**
 * A post-login redirect target taken from the URL, reduced to a same-origin path (path + query +
 * hash) or null. Rejects backslashes and control characters (browsers treat `/\evil.com` as
 * `//evil.com`), other origins and non-http schemes.
 */
export function safeNext(n: string | null | undefined): string | null {
  if (!n || /[\\\u0000-\u001f]/.test(n) || !n.startsWith('/')) return null
  try {
    const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
    const u = new URL(n, base)
    if (u.origin !== base) return null
    const out = u.pathname + u.search + u.hash
    return out.startsWith('/') && !out.startsWith('//') ? out : null
  } catch {
    return null
  }
}
