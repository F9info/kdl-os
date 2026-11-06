import { describe, it, expect, vi } from 'vitest'
import { patchFetchForStaticSite } from '@/frontend/lib/static-site'

function host() {
  const original = vi.fn(async () => new Response('{}'))
  return { fetch: original as unknown as typeof fetch, original }
}

describe('patchFetchForStaticSite', () => {
  it('a static site with no server refuses /api calls at once, and never sends them', async () => {
    const h = host()
    patchFetchForStaticSite(h, { staticSite: true })
    await expect(h.fetch('/api/menus/public')).rejects.toThrow(/no server/i)
    expect(h.original).not.toHaveBeenCalled()
  })

  it('other requests (images, fonts, files) go through untouched', async () => {
    const h = host()
    patchFetchForStaticSite(h, { staticSite: true })
    await h.fetch('/seed/photo.jpg')
    await h.fetch('https://fonts.example.com/f.woff2')
    expect(h.original).toHaveBeenCalledTimes(2)
  })

  it('with a Web app address, /api calls go to it (trailing slash tolerated)', async () => {
    const h = host()
    patchFetchForStaticSite(h, { staticSite: true, apiBase: 'https://app.example.com/' })
    await h.fetch('/api/forms/public/enquiry', { method: 'POST' })
    expect(h.original).toHaveBeenCalledWith('https://app.example.com/api/forms/public/enquiry', {
      method: 'POST',
    })
  })

  it('a normal site (not static, no address) is left alone', async () => {
    const h = host()
    const before = h.fetch
    patchFetchForStaticSite(h, { staticSite: false })
    expect(h.fetch).toBe(before)
  })

  it('patches only once, however often it is called', async () => {
    const h = host()
    patchFetchForStaticSite(h, { staticSite: true })
    const once = h.fetch
    patchFetchForStaticSite(h, { staticSite: true })
    expect(h.fetch).toBe(once)
  })
})
