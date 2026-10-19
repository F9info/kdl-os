import type { Metadata } from 'next'

/** Subset of the public sector payload the <head> needs. */
export interface SectorMeta {
  name: string
  description: string | null
  image: string | null
  seo_title: string | null
  seo_description: string | null
  og_image: string | null
  canonical_url: string | null
}

/**
 * Server-side fetch of a public sector (`GET /api/sectors/public/:slug`), so
 * crawlers and link unfurlers (WhatsApp, LinkedIn, X) get real tags without
 * running JS. Returns null for any failure — metadata must never crash a page.
 */
export async function fetchPublicSector(
  slug: string,
  projectId: string | null
): Promise<SectorMeta | null> {
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  const qs = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ''
  try {
    const res = await fetch(`${base}/api/sectors/public/${encodeURIComponent(slug)}${qs}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.data?.sector as SectorMeta | undefined) ?? null
  } catch {
    return null
  }
}

/**
 * Public origin used to resolve relative URLs (og:image, canonical). Without a
 * `metadataBase` Next falls back to http://localhost:3000, so link previews in
 * production would point at localhost. Explicit env wins; otherwise the request's own host.
 */
export function resolveSiteOrigin(
  env: { SITE_URL?: string; FRONTEND_URL?: string },
  headerGet: (name: string) => string | null
): string | undefined {
  const explicit = env.SITE_URL || env.FRONTEND_URL
  if (explicit) return explicit
  const host = headerGet('x-forwarded-host') ?? headerGet('host')
  if (!host) return undefined
  return `${headerGet('x-forwarded-proto') ?? 'http'}://${host}`
}

export function buildSectorMetadata(sector: SectorMeta, origin?: string): Metadata {
  const title = sector.seo_title || sector.name
  const description =
    sector.seo_description || (sector.description ?? '').split('\n\n')[0] || undefined
  const image = sector.og_image || sector.image
  let metadataBase: URL | undefined
  try {
    metadataBase = origin ? new URL(origin) : undefined
  } catch {
    metadataBase = undefined // a malformed env value must not break the page
  }
  return {
    metadataBase,
    title,
    description,
    alternates: sector.canonical_url ? { canonical: sector.canonical_url } : undefined,
    openGraph: { title, description, images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description },
  }
}
