import { describe, it, expect } from 'vitest'
import { vi, afterEach } from 'vitest'
import {
  buildIdentityMetadata,
  buildPageMetadata,
  fetchPublicPageMeta,
  fetchPublicPageTitle,
  type PublicPageMeta,
} from '@/frontend/lib/app-identity'

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

const meta = (m: Partial<PublicPageMeta> = {}): PublicPageMeta => ({
  title: null,
  identity: null,
  seo: null,
  seoDefaults: null,
  ...m,
})

describe('buildPageMetadata (T5.5)', () => {
  it('no page: nothing; no overrides: only the page title (root layout adds the site name)', () => {
    expect(buildPageMetadata(null)).toEqual({})
    expect(buildPageMetadata(meta({ title: 'About' })).title).toBe('About')
    expect(buildPageMetadata(meta())).toEqual({})
  })

  it('site overrides replace the site name, description and favicon', () => {
    const md = buildPageMetadata(
      meta({
        title: 'Spring',
        identity: { app_name: 'Spring Co', description: 'Big sale', favicon: '/s.ico' },
      })
    )
    expect(md).toMatchObject({
      title: { absolute: 'Spring | Spring Co' },
      description: 'Big sale',
      icons: { icon: '/s.ico' },
    })
  })

  it('prefers app_title over app_name; an override without a name keeps the plain page title', () => {
    expect(
      buildPageMetadata(meta({ title: 'Spring', identity: { app_name: 'A', app_title: 'B' } }))
        .title
    ).toEqual({ absolute: 'Spring | B' })
    expect(
      buildPageMetadata(meta({ title: 'Spring', identity: { description: 'd' } }))
    ).toMatchObject({
      title: 'Spring',
      description: 'd',
    })
  })
})

describe('buildPageMetadata SEO (T6.1)', () => {
  it('page SEO title, description, canonical and noindex', () => {
    const md = buildPageMetadata(
      meta({
        title: 'About',
        seo: {
          title: 'About Acme Ltd',
          description: 'Who we are',
          canonical: 'https://acme.test/about',
          noindex: true,
        },
      })
    )
    expect(md.title).toBe('About Acme Ltd')
    expect(md.description).toBe('Who we are')
    expect(md.alternates).toEqual({ canonical: 'https://acme.test/about' })
    expect(md.robots).toEqual({ index: false, follow: false })
  })

  it('site title template applies to the SEO title or the page title', () => {
    const seoDefaults = { title_template: '%s - Acme', og_image: '' }
    expect(buildPageMetadata(meta({ title: 'About', seoDefaults })).title).toEqual({
      absolute: 'About - Acme',
    })
    expect(
      buildPageMetadata(meta({ title: 'About', seo: { title: 'Who we are' }, seoDefaults })).title
    ).toEqual({ absolute: 'Who we are - Acme' })
  })

  it('a site name override wins over the template', () => {
    expect(
      buildPageMetadata(
        meta({
          title: 'Spring',
          identity: { app_name: 'Spring Co' },
          seoDefaults: { title_template: '%s - Acme', og_image: '' },
        })
      ).title
    ).toEqual({ absolute: 'Spring | Spring Co' })
  })

  it('share image: page image beats the default; description falls back to the site description', () => {
    const seoDefaults = { title_template: '', og_image: 'https://x.test/default.png' }
    const withPage = buildPageMetadata(
      meta({ title: 'A', seo: { og_image: 'https://x.test/p.png' }, seoDefaults })
    )
    expect(withPage.openGraph?.images).toEqual([{ url: 'https://x.test/p.png' }])
    expect(withPage.twitter).toMatchObject({ card: 'summary_large_image' })
    const onlyDefault = buildPageMetadata(
      meta({ title: 'A', identity: { description: 'Site desc' }, seoDefaults })
    )
    expect(onlyDefault.openGraph?.images).toEqual([{ url: 'https://x.test/default.png' }])
    expect(onlyDefault.description).toBe('Site desc')
  })

  it('no image: summary card; origin becomes metadataBase, a malformed one is ignored', () => {
    expect(buildPageMetadata(meta({ title: 'A' })).twitter).toMatchObject({ card: 'summary' })
    expect(buildPageMetadata(meta({ title: 'A' }), 'https://acme.test').metadataBase?.href).toBe(
      'https://acme.test/'
    )
    expect(buildPageMetadata(meta({ title: 'A' }), 'not a url').metadataBase).toBeUndefined()
  })
})

describe('fetchPublicPageMeta (T5.5)', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('returns the title and the site identity overrides', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ data: { page: { title: ' T ', identity: { app_name: 'X' } } } }),
      }))
    )
    expect(await fetchPublicPageMeta('p')).toEqual({
      title: 'T',
      identity: { app_name: 'X' },
      seo: null,
      seoDefaults: null,
    })
  })
})
