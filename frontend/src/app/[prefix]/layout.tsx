import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { fetchPublicPageTitle } from '@/lib/app-identity'

// "/<page-key>": the tab shows "<page title> | <site name>" (the site name template comes from the root layout).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefix: string }>
}): Promise<Metadata> {
  const { prefix } = await params
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const title = await fetchPublicPageTitle(`site/${encodeURIComponent(prefix)}`, host)
  return title ? { title } : {}
}

export default function SiteKeyLayout({ children }: { children: React.ReactNode }) {
  return children
}
