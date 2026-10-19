import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { buildSectorMetadata, fetchPublicSector, resolveSiteOrigin } from '@/lib/sector-metadata'
import { siteProjectId } from '@/lib/site-project'
import SectorDetailClient from './SectorDetailClient'

// Server component so the <head> is in the initial HTML for crawlers and
// link unfurlers; the interactive page itself stays a client component.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ projectId?: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const { projectId } = await searchParams
  const sector = await fetchPublicSector(slug, siteProjectId(projectId ?? null))
  const h = await headers()
  const origin = resolveSiteOrigin(
    { SITE_URL: process.env.SITE_URL, FRONTEND_URL: process.env.FRONTEND_URL },
    (name) => h.get(name)
  )
  return sector ? buildSectorMetadata(sector, origin) : { title: 'Sector not found' }
}

export default function SectorDetailPage() {
  return <SectorDetailClient />
}
