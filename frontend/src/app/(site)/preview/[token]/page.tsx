'use client'

import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageRender } from '@/frontend/rendering/PageRender'
import { getPageByPreviewToken } from '@/frontend/pages/page-record'
import { useIdentity } from '@/hooks/useIdentity'

/**
 * Signed preview of a page's working copy (T6.3). The link itself is the credential: no login. Shows
 * the unpublished draft exactly as visitors would see it once published, under a banner that says
 * it is a preview.
 */
export default function PreviewPage() {
  const { token } = useParams<{ token: string }>()
  const { identity, isLoading: identityLoading } = useIdentity()
  const {
    data: page,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['page-preview', token],
    queryFn: () => getPageByPreviewToken(token),
    retry: false,
    refetchOnWindowFocus: false,
  })

  if (isLoading || identityLoading) return <div className="min-h-screen" />
  if (isError || !page) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-slate-500">
        <p>This preview link is not valid or has expired. Ask for a new one.</p>
      </div>
    )
  }
  return (
    <>
      <div
        role="status"
        className="sticky top-0 z-[100] bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900"
      >
        Preview{page.status === 'PUBLISHED' ? '' : ' (not published yet)'}: you are seeing the
        latest draft of &ldquo;{page.title}&rdquo;
      </div>
      <PageRender page={page} identity={identity} />
    </>
  )
}
