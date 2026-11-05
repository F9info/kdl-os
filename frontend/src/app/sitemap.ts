import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { originFromRequest } from '@/frontend/lib/sector-metadata'

// Rendered per request: the site (and so the page list) depends on the visitor's host (T5.2).
export const dynamic = 'force-dynamic'

/** /sitemap.xml: the indexable published pages of the site this host serves. Empty on any failure. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers()
  const origin = originFromRequest(h)
  if (!origin) return []
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const base = process.env.BACKEND_INTERNAL_URL ?? 'http://backend:4000'
  try {
    const res = await fetch(
      `${base}/api/page-builder/public/sitemap${host ? `?host=${encodeURIComponent(host)}` : ''}`,
      { cache: 'no-store' }
    )
    if (!res.ok) return []
    const entries = ((await res.json())?.data?.entries ?? []) as { path: string; lastmod: string }[]
    return entries.map((e) => ({
      url: new URL(e.path, origin).toString(),
      lastModified: new Date(e.lastmod),
    }))
  } catch {
    return []
  }
}
