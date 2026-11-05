/**
 * Regression tests for server-side sector metadata (Issue 8): /sectors/[slug]
 * used to set title/meta in a client useEffect, invisible to crawlers that
 * don't run JS. These pin the head content and the fetch contract.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  buildSectorMetadata,
  fetchPublicSector,
  resolveSiteOrigin,
  type SectorMeta,
} from '@/frontend/lib/sector-metadata'

const sector = (over: Partial<SectorMeta> = {}): SectorMeta => ({
  name: 'Hotel',
  description: 'First paragraph.\n\nSecond paragraph.',
  image: '/seed/hotel.jpg',
  seo_title: null,
  seo_description: null,
  og_image: null,
  canonical_url: null,
  ...over,
})

afterEach(() => vi.unstubAllGlobals())

describe('buildSectorMetadata', () => {
  it('falls back to name, first description paragraph and the sector image', () => {
    const m = buildSectorMetadata(sector())
    expect(m.title).toBe('Hotel')
    expect(m.description).toBe('First paragraph.')
    expect(m.openGraph?.images).toEqual([{ url: '/seed/hotel.jpg' }])
    expect(m.alternates).toBeUndefined()
  })

  it('prefers explicit SEO fields, og_image and canonical', () => {
    const m = buildSectorMetadata(
      sector({
        seo_title: 'Hotel construction',
        seo_description: 'Custom',
        og_image: '/og.png',
        canonical_url: 'https://x.test/sectors/hotel',
      })
    )
    expect(m.title).toBe('Hotel construction')
    expect(m.description).toBe('Custom')
    expect(m.openGraph?.images).toEqual([{ url: '/og.png' }])
    expect(m.alternates?.canonical).toBe('https://x.test/sectors/hotel')
  })

  it('has no image and a plain twitter card when the sector has none', () => {
    const m = buildSectorMetadata(sector({ image: null }))
    expect(m.openGraph?.images).toBeUndefined()
    expect((m.twitter as { card?: string }).card).toBe('summary')
  })
})

describe('fetchPublicSector', () => {
  it('calls the real public endpoint with an encoded slug and project scope', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { sector: sector() } }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await fetchPublicSector('hotel', 'proj 1')
    expect(out?.name).toBe('Hotel')
    expect(fetchMock.mock.calls[0]![0]).toMatch(
      /\/api\/sectors\/public\/hotel\?project_id=proj%201$/
    )
  })

  it('returns null on 404, bad payload, or network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await fetchPublicSector('nope', null)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await fetchPublicSector('nope', null)).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    expect(await fetchPublicSector('nope', null)).toBeNull()
  })
})

describe('metadataBase (relative og:image must not resolve to localhost)', () => {
  it('sets metadataBase from the given origin', () => {
    expect(buildSectorMetadata(sector(), 'https://example.com').metadataBase?.href).toBe(
      'https://example.com/'
    )
  })
  it('ignores a malformed origin instead of throwing', () => {
    expect(buildSectorMetadata(sector(), 'not a url').metadataBase).toBeUndefined()
  })
  it('prefers explicit env, then forwarded headers, then host', () => {
    const none = () => null
    expect(resolveSiteOrigin({ SITE_URL: 'https://a.com' }, none)).toBe('https://a.com')
    expect(resolveSiteOrigin({ FRONTEND_URL: 'https://b.com' }, none)).toBe('https://b.com')
    const h = (n: string) =>
      ({ 'x-forwarded-host': 'c.com', 'x-forwarded-proto': 'https' })[n] ?? null
    expect(resolveSiteOrigin({}, h)).toBe('https://c.com')
    const plain = (n: string) => (n === 'host' ? 'd.com' : null)
    expect(resolveSiteOrigin({}, plain)).toBe('http://d.com')
    expect(resolveSiteOrigin({}, none)).toBeUndefined()
  })
})
