import { describe, it, expect } from 'vitest'
import { vi, afterEach } from 'vitest'
import { buildIdentityMetadata, fetchPublicPageTitle } from '@/lib/app-identity'

describe('buildIdentityMetadata', () => {
  it('uses defaults when identity is empty', () => {
    expect(buildIdentityMetadata({})).toEqual({
      title: { default: 'KDL Admin', template: '%s | KDL Admin' },
      description: 'KDL Starter Kit Admin Panel',
    })
  })

  it('prefers app_title, then app_name, and adds the favicon', () => {
    expect(
      buildIdentityMetadata({ app_title: 'T', app_name: 'N', favicon: 'https://x/f.png' })
    ).toMatchObject({
      title: { default: 'T', template: '%s | T' },
      icons: { icon: 'https://x/f.png' },
    })
    expect(buildIdentityMetadata({ app_title: '', app_name: 'N' }).title).toEqual({
      default: 'N',
      template: '%s | N',
    })
  })
})

describe('fetchPublicPageTitle', () => {
  afterEach(() => vi.unstubAllGlobals())
  const stub = (res: unknown) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => res)
    )

  it('returns the published page title', async () => {
    stub({ ok: true, json: async () => ({ data: { page: { title: ' About us ' } } }) })
    expect(await fetchPublicPageTitle('site/about')).toBe('About us')
  })

  it('sends the visitor host so the backend can pick the site (and cache per host)', async () => {
    const f = vi.fn(async (_url: string) => ({
      ok: true,
      json: async () => ({ data: { page: { title: 'A' } } }),
    }))
    vi.stubGlobal('fetch', f)
    await fetchPublicPageTitle('site/about', 'Shop.Example.com')
    expect(f.mock.calls[0]![0]).toContain('/site/about?host=Shop.Example.com')
    await fetchPublicPageTitle('site/about')
    expect(f.mock.calls[1]![0]).not.toContain('host=')
  })

  it('returns null for a missing page, a bad status or a network error', async () => {
    stub({ ok: true, json: async () => ({ data: { page: null } }) })
    expect(await fetchPublicPageTitle('site/x')).toBeNull()
    stub({ ok: false })
    expect(await fetchPublicPageTitle('site/x')).toBeNull()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('down')
      })
    )
    expect(await fetchPublicPageTitle('site/x')).toBeNull()
  })
})
