import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SitePage from '@/components/SitePage'
import { getPage } from '@/lib/content'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ prefix: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return { title: getPage((await params).prefix)?.title ?? 'Not found' }
}

export default async function Page({ params }: Params) {
  const page = getPage((await params).prefix)
  if (!page) notFound()
  return <SitePage data={page.data} title={page.title} projectId={page.projectId} />
}
