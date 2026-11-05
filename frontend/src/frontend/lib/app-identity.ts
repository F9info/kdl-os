import type { Metadata } from 'next'
import type { PageSeo, PublicSeoDefaults } from '@/lib/seo'
import { PUBLIC_PAGES_TAG } from '@/frontend/lib/revalidate'

const DEFAULT_TITLE = 'KDL Admin'
const DEFAULT_DESCRIPTION = 'KDL Starter Kit Admin Panel'

/**
 * Server-side fetch of the public application identity (`GET /api/app-config`) for <head>.
 * Returns {} on any failure (backend down, build time) — metadata must never crash a page.
 */
export async function fetchAppIdentity(): Promise<Record<string, string>> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  try {
    const res = await fetch(`${base}/api/app-config`, { next: { revalidate: 60 } })
    if (!res.ok) return {}
    const json = await res.json()
    return (json?.data?.identity as Record<string, string> | undefined) ?? {}
  } catch {
    return {}
  }
}

/**
 * Tab title, description and favicon from identity; empty values keep the old defaults. The
 * title is a template, so a page that sets its own title becomes "<page> | <site name>".
 */
export function buildIdentityMetadata(identity: Record<string, string>): Metadata {
  const siteName = identity.app_title || identity.app_name || DEFAULT_TITLE
  return {
    title: { default: siteName, template: `%s | ${siteName}` },
    description: identity.description || DEFAULT_DESCRIPTION,
    ...(identity.favicon ? { icons: { icon: identity.favicon } } : {}),
  }
}

export interface PublicPageMeta {
  title: string | null
  /** The site's identity overrides (T5.5), or null when the site has none. */
  identity: Record<string, string> | null
  /** The page's own SEO (T6.1) and the site-wide defaults, each null when none. */
  seo: PageSeo | null
  seoDefaults: PublicSeoDefaults | null
}

/**
 * Title and identity overrides of a published site page (`path` is the backend public route, e.g.
 * `site/about` or `my-slug`). `host` is the visitor's host: the backend picks the site by it (T5.2),
 * and it keeps the cached answer per host. Null when missing or on any failure.
 */
export async function fetchPublicPageMeta(
  path: string,
  host?: string | null
): Promise<PublicPageMeta | null> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  const query = host ? `?host=${encodeURIComponent(host)}` : ''
  try {
    // Cached 60 s, or until the backend calls /revalidate after a publish (tag below).
    const res = await fetch(`${base}/api/page-builder/public/${path}${query}`, {
      next: { revalidate: 60, tags: [PUBLIC_PAGES_TAG] },
    })
    if (!res.ok) return null
    const page = (await res.json())?.data?.page
    return {
      title: (page?.title as string | undefined)?.trim() || null,
      identity: (page?.identity as Record<string, string> | null | undefined) ?? null,
      seo: (page?.seo as PageSeo | null | undefined) ?? null,
      seoDefaults: (page?.seoDefaults as PublicSeoDefaults | null | undefined) ?? null,
    }
  } catch {
    return null
  }
}

/** Title of a published site page; null when missing or on any failure. */
export async function fetchPublicPageTitle(
  path: string,
  host?: string | null
): Promise<string | null> {
  return (await fetchPublicPageMeta(path, host))?.title ?? null
}

/**
 * <head> data of a public page. Without any overrides only the page title is set (the root layout
 * adds " | <project name>"). Title: the page's SEO title or its name, then " | <site name>" when the
 * site overrides its name (T5.5), else the site-wide title template (T6.1), else the root template.
 * Description, share image, canonical and noindex come from the page's SEO, falling back to the
 * site's description and the default share image. `origin` resolves relative image/canonical URLs.
 */
export function buildPageMetadata(meta: PublicPageMeta | null, origin?: string): Metadata {
  if (!meta) return {}
  const { identity, seo, seoDefaults } = meta
  const base = seo?.title || meta.title
  const siteName = identity?.app_title || identity?.app_name || ''
  const template = seoDefaults?.title_template ?? ''
  const full = siteName
    ? base
      ? `${base} | ${siteName}`
      : siteName
    : template && base
      ? template.replace('%s', base)
      : ''
  const description = seo?.description || identity?.description || undefined
  const image = seo?.og_image || seoDefaults?.og_image || undefined
  const shared = full || base || undefined

  let metadataBase: URL | undefined
  try {
    metadataBase = origin ? new URL(origin) : undefined
  } catch {
    metadataBase = undefined // a malformed env value must not break the page
  }

  return {
    ...(metadataBase ? { metadataBase } : {}),
    // `absolute` skips the root layout's " | <project name>" template.
    ...(full ? { title: { absolute: full } } : base ? { title: base } : {}),
    ...(description ? { description } : {}),
    ...(identity?.favicon ? { icons: { icon: identity.favicon } } : {}),
    ...(seo?.canonical ? { alternates: { canonical: seo.canonical } } : {}),
    ...(seo?.noindex ? { robots: { index: false, follow: false } } : {}),
    ...(shared || description || image
      ? {
          openGraph: {
            ...(shared ? { title: shared } : {}),
            ...(description ? { description } : {}),
            ...(image ? { images: [{ url: image }] } : {}),
          },
          twitter: { card: image ? 'summary_large_image' : 'summary' },
        }
      : {}),
  }
}
