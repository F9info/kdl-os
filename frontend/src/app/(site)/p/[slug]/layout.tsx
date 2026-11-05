import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { buildPageMetadata, fetchPublicPageMeta } from '@/frontend/lib/app-identity'
import { originFromRequest } from '@/frontend/lib/sector-metadata'

// "/p/<slug>": the tab shows "<page title> | <site name>" (the site name template comes from the root layout).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const h = await headers()
  const meta = await fetchPublicPageMeta(encodeURIComponent(slug))
  return buildPageMetadata(meta, originFromRequest(h))
}

export default function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return children
}
