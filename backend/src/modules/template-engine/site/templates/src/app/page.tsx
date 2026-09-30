import type { Metadata } from 'next'
import SitePage from '@/components/SitePage'
import { getPage } from '@/lib/content'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  return { title: getPage('')?.title ?? 'Home' }
}

export default function Home() {
  const page = getPage('')
  if (!page) return <p style={{ padding: 32 }}>No home page yet.</p>
  return <SitePage data={page.data} title={page.title} projectId={page.projectId} />
}
