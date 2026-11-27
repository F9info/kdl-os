import type { Metadata } from 'next'
import { headers } from 'next/headers'
import {
  buildIdentityMetadata,
  buildPageMetadata,
  fetchAppIdentity,
  fetchPublicPageMeta,
} from '@/frontend/lib/app-identity'
import { originFromRequest } from '@/frontend/lib/sector-metadata'

// "/<section>/<page>" (e.g. /devfest/program): the tab shows that page's own title. When the address
// is not a site page (a Details Page entry), nothing is returned and the section's title stays.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ prefix: string; slug: string }>
}): Promise<Metadata> {
  const { prefix, slug } = await params
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const meta = await fetchPublicPageMeta(`site/${encodeURIComponent(`${prefix}/${slug}`)}`, host)
  const out = buildPageMetadata(meta, originFromRequest(h))
  // The section's layout sets a plain title, which stops the root "<page> | <site>" template from
  // reaching this level, so apply that template here.
  if (typeof out.title === 'string') {
    const root = buildIdentityMetadata(await fetchAppIdentity()).title
    const template = root && typeof root === 'object' && 'template' in root ? root.template : null
    if (template) out.title = { absolute: template.replace('%s', out.title) }
  }
  return out
}

export default function NestedSiteKeyLayout({ children }: { children: React.ReactNode }) {
  return children
}
