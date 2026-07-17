'use client'

// KDL-148 — public "Share / copy link" landing page.
//
// ShareDialog.tsx builds the copyable link as `<frontend-origin>/share/:token`
// (see shareUrl() in components/media/ShareDialog.tsx). Before this page
// existed, that link was pure dead-end: the backend resolves the token fine
// at its own origin (GET/POST /share/:token in backend/src/index.js — public,
// no auth, rate-limited), but the frontend had no route for it at all, so an
// external recipient visiting the copied link got a 404. This page renders
// that response; next.config.ts proxies `/api/public-share/:token` to the
// backend's `/share/:token` so the browser never needs to know the backend's
// internal/public host.
//
// Intentionally does NOT use the shared `lib/axios.ts` singleton: its
// response interceptor treats any 401 as "session expired" and force-redirects
// to /login (see api.interceptors.response.use in lib/axios.ts) — which would
// hijack the legitimate "this link needs a password" case below for a visitor
// who was never logged in to begin with. Plain fetch avoids that entirely.

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatBytes } from '@/lib/utils'
import { AppImage } from '@/components/shared/AppImage'

interface SharedMediaItem {
  id: string
  original_name: string
  mime_type: string
  url: string | null
  size: number
}

interface SharedFolderInfo {
  id: string
  name: string
}

type ShareData =
  | { type: 'media'; media: SharedMediaItem }
  | { type: 'folder'; folder: SharedFolderInfo; items: SharedMediaItem[] }

type Status = 'loading' | 'ready' | 'needs-password' | 'gone' | 'error'

function MediaPreview({ item }: { item: SharedMediaItem }) {
  const isImage = item.mime_type.startsWith('image/')
  const isVideo = item.mime_type.startsWith('video/')
  const isAudio = item.mime_type.startsWith('audio/')

  return (
    <div className="space-y-3">
      {isImage && item.url && (
        <AppImage size="content" src={item.url} alt={item.original_name} className="max-w-full rounded border" />
      )}
      {isVideo && item.url && (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={item.url} controls className="w-full rounded border" />
      )}
      {isAudio && item.url && <audio src={item.url} controls className="w-full" />}
      {!isImage && !isVideo && !isAudio && (
        <div className="rounded border p-6 text-center text-sm text-muted-foreground">
          No inline preview for this file type.
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.original_name}</p>
          <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
        </div>
        {item.url && (
          <Button asChild size="sm">
            <a href={item.url} download={item.original_name}>
              Download
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

export default function SharePage() {
  const params = useParams<{ token: string }>()
  const token = params.token

  const [status, setStatus] = useState<Status>('loading')
  const [data, setData] = useState<ShareData | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const resolve = useCallback(async (pwd?: string) => {
    try {
      const res = await fetch(`/api/public-share/${token}`, {
        method: pwd ? 'POST' : 'GET',
        headers: pwd ? { 'Content-Type': 'application/json' } : undefined,
        body: pwd ? JSON.stringify({ password: pwd }) : undefined,
        cache: 'no-store',
      })
      const json = (await res.json().catch(() => null)) as
        | { success: true; data: ShareData }
        | { success: false; message: string }
        | null

      if (res.ok && json?.success) {
        setData(json.data)
        setStatus('ready')
        setPasswordError(null)
        return
      }

      if (res.status === 401) {
        setStatus('needs-password')
        return
      }
      if (res.status === 403) {
        setStatus('needs-password')
        setPasswordError(json && !json.success ? json.message : 'Incorrect password')
        return
      }
      if (res.status === 410) {
        setStatus('gone')
        setMessage((json && !json.success && json.message) || 'This link has expired or been revoked.')
        return
      }
      setStatus('error')
      setMessage((json && !json.success && json.message) || 'This link is not available.')
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [token])

  useEffect(() => {
    if (token) void resolve()
    // Only re-resolve when the token itself changes — password submission is
    // handled by the explicit form submit below, not by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    void resolve(password)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md bg-background border rounded-lg shadow-sm p-6 space-y-4">
        <h1>Shared file</h1>

        {status === 'loading' && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {status === 'gone' && (
          <p className="text-sm text-destructive">{message}</p>
        )}

        {status === 'error' && (
          <p className="text-sm text-destructive">{message}</p>
        )}

        {status === 'needs-password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This link is password-protected.
            </p>
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <Button type="submit" disabled={submitting || !password} className="w-full">
              {submitting ? 'Checking…' : 'View file'}
            </Button>
          </form>
        )}

        {status === 'ready' && data?.type === 'media' && <MediaPreview item={data.media} />}

        {status === 'ready' && data?.type === 'folder' && (
          <div className="space-y-3">
            <p className="text-sm font-medium">{data.folder.name}</p>
            <ul className="divide-y border rounded">
              {data.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <span className="truncate">{item.original_name}</span>
                  {item.url && (
                    <a href={item.url} download={item.original_name} className="text-primary underline shrink-0">
                      Download
                    </a>
                  )}
                </li>
              ))}
              {data.items.length === 0 && (
                <li className="p-2 text-sm text-muted-foreground">This folder is empty.</li>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
