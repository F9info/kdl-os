'use client'

// KDL Phase D8 — OAuth popup callback for cloud media imports.
// The provider redirects here with ?code=&state=; we relay them to the opener
// (CloudImportDialog) via postMessage and the user closes this window.

import { Suspense, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

function CallbackRelay() {
  const params = useSearchParams()

  useEffect(() => {
    const code = params.get('code')
    const state = params.get('state')
    if (code && state) {
      window.opener?.postMessage(
        { type: 'media-import-oauth', code, state },
        window.location.origin
      )
    }
  }, [params])

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <p className="text-sm text-muted-foreground">
        Authorization complete. You can close this window.
      </p>
    </div>
  )
}

export default function MediaImportOauthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackRelay />
    </Suspense>
  )
}
