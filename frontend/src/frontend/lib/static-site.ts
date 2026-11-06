// "Convert to Static Website" builds a site that is only files: no server of its own. Blocks still call
// relative `/api/...` (menus, page text, forms). On such a site those calls are either sent to the Web
// app address the owner gave at conversion (NEXT_PUBLIC_API_BASE), or, with no address, refused at once.
// That keeps the page from asking the host for URLs that do not exist (which some hosts answer with
// an HTML page, or with a slow 404) and lets every block fall back to the content baked into it.
type FetchHost = {
  fetch: typeof fetch
  __kdlFetchPatched?: boolean
}

export function patchFetchForStaticSite(
  host: FetchHost,
  opts: { staticSite: boolean; apiBase?: string }
): void {
  const base = opts.apiBase?.replace(/\/$/, '')
  if (host.__kdlFetchPatched || (!base && !opts.staticSite)) return
  host.__kdlFetchPatched = true
  const original = host.fetch.bind(host)
  host.fetch = (input, init) => {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      return base
        ? original(base + input, init)
        : Promise.reject(new TypeError('This static website has no server'))
    }
    return original(input, init)
  }
}
