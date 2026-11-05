import type { Metadata } from 'next'
import { fetchPublicPageTitle } from '@/lib/app-identity'

// "/p/<slug>": the tab shows "<page title> | <site name>" (the site name template comes from the root layout).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const title = await fetchPublicPageTitle(encodeURIComponent(slug))
  return title ? { title } : {}
}

export default function PublicPageLayout({ children }: { children: React.ReactNode }) {
  return children
}
