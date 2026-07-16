'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Render, type Data } from '@puckeditor/core'
import { config } from '@/app/admin/page-builder/puck.config'
import { getPageBySlug } from '@/app/admin/page-builder/store'

/**
 * Public, responsive renderer for a published page.
 *
 * Uses the SAME `config` as the editor so what an admin builds is exactly what
 * a visitor sees. No Puck editor chrome ships here — just `<Render />`, which
 * outputs plain responsive markup that adapts to any screen size.
 *
 * POC note: reads the page from the browser store. In production this route
 * becomes a server component that fetches the page from the `page-builder`
 * backend module and passes `data` straight into `<Render />`.
 */
export default function PublicPage() {
  const params = useParams<{ slug: string }>()
  const [data, setData] = useState<Data | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    const page = getPageBySlug(params.slug)
    if (page) setData(page.data)
    else setMissing(true)
  }, [params.slug])

  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        <p>404 — no published page at /p/{params.slug}</p>
      </div>
    )
  }

  if (!data) return <div className="min-h-screen" />

  return <Render config={config} data={data} />
}
