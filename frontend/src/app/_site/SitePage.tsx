'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { Render } from '@puckeditor/core'
import { applyHeaderOverlay } from '@/lib/header-overlay'
import { applyIdentity } from '@/lib/apply-identity'
import { applySiteLayout } from '@/lib/apply-site-layout'
import { useIdentity } from '@/hooks/useIdentity'
import { config } from '@/app/admin/page-builder/puck.config'
import { getPageBySiteKey } from '@/app/admin/page-builder/store'

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
  return (
    <Render
      config={config}
      data={applyHeaderOverlay(applyIdentity(applySiteLayout(page.data, page.layout), identity))}
      metadata={{ pageTitle: page.title, projectId: page.projectId ?? undefined }}
    />
  )
}
