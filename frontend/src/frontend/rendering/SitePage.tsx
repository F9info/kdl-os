'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useIdentity } from '@/hooks/useIdentity'
import { PageRender } from './PageRender'
import { getPageBySiteKey } from '@/frontend/pages/page-record'

/**
 * Public renderer for the site's own URLs: "/" (key "home") and "/<key>". Same `config` as the
 * editor, so what an admin builds is what a visitor sees. With no published home page yet the
 * root falls back to the login screen (a fresh install has no site).
 */
export function SitePage({
  pageKey,
  fallbackToLogin = false,
}: {
  pageKey: string
  fallbackToLogin?: boolean
}) {
  const router = useRouter()
  const { identity, isLoading: identityLoading } = useIdentity()
  const { data: page, isLoading } = useQuery({
    queryKey: ['public-site-page', pageKey],
    queryFn: () => getPageBySiteKey(pageKey),
    retry: false,
  })
  const missing = !isLoading && !page
  useEffect(() => {
    if (missing && fallbackToLogin) router.replace('/login')
  }, [missing, fallbackToLogin, router])

  // Wait for identity too, so the baked brand never flashes before the live one.
  if (isLoading || identityLoading || (missing && fallbackToLogin))
    return <div className="min-h-screen" />
  if (!page) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no published page at /{pageKey === 'home' ? '' : pageKey}</p>
      </div>
    )
  }
  return <PageRender page={page} identity={identity} />
}
