import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import SitePage from '@/components/SitePage'
import { getPage, getShared, listRoutes, seoMetadata } from '@/lib/content'

export const dynamic = 'force-dynamic'

export function generateStaticParams() {
  return listRoutes()
    .filter(Boolean)
    .map((prefix) => ({ prefix }))
}

type Params = { params: Promise<{ prefix: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  return seoMetadata(getPage((await params).prefix), 'Not found')
}

export default async function Page({ params }: Params) {
  const page = getPage((await params).prefix)
  if (!page) notFound()
  return <SitePage data={page.data} title={page.title} projectId={page.projectId} identity={page.identity} shared={getShared()} />
}
