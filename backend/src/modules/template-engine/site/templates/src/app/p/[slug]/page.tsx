import { notFound, redirect } from 'next/navigation'
import { routeForSlug } from '@/lib/content'

export const dynamic = 'force-dynamic'

// Links saved in the admin point at /p/<slug>; the generated site serves the
// friendly URL instead.
export default async function Legacy({ params }: { params: Promise<{ slug: string }> }) {
  const route = routeForSlug((await params).slug)
  if (route === null) notFound()
  redirect(route ? `/${route}` : '/')
}
