import type { Metadata } from 'next'
import SitePage from '@/components/SitePage'
import { getPage, seoMetadata } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return seoMetadata(getPage(''), 'Home')
}

export default function Home() {
  const page = getPage('')
  if (!page) return <p style={{ padding: 32 }}>No home page yet.</p>
  return <SitePage data={page.data} title={page.title} projectId={page.projectId} identity={page.identity} />
}
