// Public URL of the generated site's home page: "/" (served from the page keyed "home"), or
// "/<key>" of the first page when the site has no home page. null until a website exists.
export function useSiteHomeHref(pageKeyToId?: Record<string, string> | null): string | null {
  const keys = Object.keys(pageKeyToId ?? {})
  if (keys.length === 0) return null
  return keys.includes('home') ? '/' : `/${keys[0]}`
}
