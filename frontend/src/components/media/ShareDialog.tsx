'use client'

// B4 — Share links dialog: list, create, copy, QR, embed, revoke

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, QrCode, Code2, Trash2, Plus, Eye, EyeOff } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AppImage } from '@/components/shared/AppImage'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ShareLink {
  id: string
  token: string
  has_password: boolean
  expires_at: string | null
  max_downloads: number | null
  download_count: number
  created_at: string
}

interface CreateSharePayload {
  password?: string
  expires_at?: string
  max_downloads?: number
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const shareApi = {
  list: (mediaId: string) =>
    api.get(`/media/${mediaId}/shares`).then((r) => r.data.data.shares as ShareLink[]),
  // Backend route is `POST /media/shares` with `media_id` in the body (see
  // routes.js + createShareSchema) — there is no `/media/:id/shares` POST
  // route. This previously 404'd on every attempt; never caught because this
  // dialog was never rendered anywhere in the app (KDL-148).
  // createShareLink responds via `successResponse(res, share, 201)` — the
  // share record IS `data` (flat), not `{ share }` like the list endpoint.
  create: (mediaId: string, payload: CreateSharePayload) =>
    api
      .post(`/media/shares`, { ...payload, media_id: mediaId })
      .then((r) => r.data.data as ShareLink),
  // Backend route is `DELETE /media/shares/:id` keyed by the share record's
  // cuid `id`, not its public `token` — passing the token failed schema
  // validation (shareIdParamSchema expects a cuid) on every revoke attempt.
  revoke: (id: string) => api.delete(`/media/shares/${id}`),
}

// ─── Badge helper ─────────────────────────────────────────────────────────────

function shareBadge(share: ShareLink) {
  if (share.has_password) return { label: 'password', variant: 'secondary' as const }
  if (share.expires_at) return { label: 'expiry', variant: 'outline' as const }
  return { label: 'public', variant: 'default' as const }
}

function shareUrl(token: string) {
  if (typeof window === 'undefined') return `/share/${token}`
  return `${window.location.origin}/share/${token}`
}

function embedHtml(token: string, mediaName: string) {
  const url = shareUrl(token)
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${mediaName}</a>`
}

// ─── Single share row ─────────────────────────────────────────────────────────

function ShareRow({
  share,
  mediaName,
  onRevoked,
}: {
  share: ShareLink
  mediaName: string
  onRevoked: () => void
}) {
  const [showQr, setShowQr] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const badge = shareBadge(share)
  const link = shareUrl(share.token)
  const embed = embedHtml(share.token, mediaName)

  const revokeMut = useMutation({
    mutationFn: () => shareApi.revoke(share.id),
    onSuccess: () => {
      toast({ title: 'Share revoked' })
      onRevoked()
    },
    onError: () => toast({ title: 'Revoke failed', variant: 'destructive' }),
  })

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast({ title: 'Link copied!' })
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' })
    }
  }

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={badge.variant} className="text-xs">
          {badge.label}
        </Badge>
        <span className="text-xs text-muted-foreground truncate flex-1 min-w-0">{link}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {share.download_count} dl{share.download_count !== 1 ? 's' : ''}
        </span>
      </div>

      {share.expires_at && (
        <p className="text-xs text-muted-foreground">
          Expires {new Date(share.expires_at).toLocaleDateString()}
        </p>
      )}
      {share.max_downloads != null && (
        <p className="text-xs text-muted-foreground">Max downloads: {share.max_downloads}</p>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1" onClick={copyLink}>
          <Copy className="h-3 w-3" /> Copy
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setShowQr((v) => !v)}
        >
          <QrCode className="h-3 w-3" /> QR
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs gap-1"
          onClick={() => setShowEmbed((v) => !v)}
        >
          <Code2 className="h-3 w-3" /> Embed
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive ml-auto"
          onClick={() => revokeMut.mutate()}
          disabled={revokeMut.isPending}
        >
          <Trash2 className="h-3 w-3" /> Revoke
        </Button>
      </div>

      {showQr && (
        <div className="pt-1">
          <AppImage
            size="thumbnail"
            src={`/api/media/shares/${share.token}/qr`}
            alt={`QR code for ${mediaName}`}
            className="border rounded"
          />
        </div>
      )}

      {showEmbed && (
        <textarea
          readOnly
          value={embed}
          className="w-full text-xs border rounded p-2 font-mono bg-muted/30 resize-none h-16"
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
        />
      )}
    </div>
  )
}

// ─── Create share form ────────────────────────────────────────────────────────

function CreateShareForm({ mediaId, onCreated }: { mediaId: string; onCreated: () => void }) {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [expiresAt, setExpiresAt] = useState('')
  const [maxDownloads, setMaxDownloads] = useState('')
  const [open, setOpen] = useState(false)

  const createMut = useMutation({
    mutationFn: () => {
      const payload: CreateSharePayload = {}
      if (password.trim()) payload.password = password.trim()
      if (expiresAt) payload.expires_at = new Date(expiresAt).toISOString()
      if (maxDownloads) payload.max_downloads = parseInt(maxDownloads, 10)
      return shareApi.create(mediaId, payload)
    },
    onSuccess: () => {
      toast({ title: 'Share link created' })
      setPassword('')
      setExpiresAt('')
      setMaxDownloads('')
      setOpen(false)
      onCreated()
    },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="gap-1" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> New share link
      </Button>
    )
  }

  return (
    <div className="border rounded-md p-3 space-y-3 bg-muted/20">
      <p className="text-sm font-medium">New share link</p>

      <div className="space-y-1">
        <Label className="text-xs">Password (optional)</Label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank for public link"
            className="h-8 text-sm pr-8"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1.5 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Expires at (optional)</Label>
        <Input
          type="date"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          className="h-8 text-sm"
          min={new Date().toISOString().split('T')[0]}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Max downloads (optional)</Label>
        <Input
          type="number"
          value={maxDownloads}
          onChange={(e) => setMaxDownloads(e.target.value)}
          placeholder="Unlimited"
          min={1}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
          Create link
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={createMut.isPending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── Main dialog ──────────────────────────────────────────────────────────────

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  mediaId: string
  mediaName: string
}

export function ShareDialog({ open, onClose, mediaId, mediaName }: ShareDialogProps) {
  const queryClient = useQueryClient()

  const { data: shares, isLoading } = useQuery({
    queryKey: ['media-shares', mediaId],
    queryFn: () => shareApi.list(mediaId),
    enabled: open,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['media-shares', mediaId] })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="truncate">Share — {mediaName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <CreateShareForm mediaId={mediaId} onCreated={invalidate} />

          {isLoading && <p className="text-sm text-muted-foreground">Loading shares…</p>}

          {!isLoading && (!shares || shares.length === 0) && (
            <p className="text-sm text-muted-foreground">No share links yet.</p>
          )}

          {(shares ?? []).map((share) => (
            <ShareRow key={share.id} share={share} mediaName={mediaName} onRevoked={invalidate} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
