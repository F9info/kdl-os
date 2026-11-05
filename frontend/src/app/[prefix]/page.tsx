'use client'

import { useParams } from 'next/navigation'
import { SitePage } from '../_site/SitePage'

// "/<page-key>" — a site page at its clean URL (e.g. /about). Static routes (admin, login, p, ...) win.
export default function SiteKeyPage() {
  const { prefix } = useParams<{ prefix: string }>()
  return <SitePage pageKey={prefix} />
}
