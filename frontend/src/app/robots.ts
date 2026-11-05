import type { MetadataRoute } from 'next'
import { headers } from 'next/headers'
import { originFromRequest } from '@/frontend/lib/sector-metadata'

export const dynamic = 'force-dynamic'

// Crawlers may read the public site; the admin, API and login areas are not for search results.
export const ROBOTS_DISALLOW = ['/admin', '/api', '/login', '/share']

/** /robots.txt */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers()
  const origin = originFromRequest(h)
  return {
    rules: { userAgent: '*', allow: '/', disallow: ROBOTS_DISALLOW },
    ...(origin ? { sitemap: new URL('/sitemap.xml', origin).toString() } : {}),
  }
}
