'use client'

// B5 — Version history panel: list, download, restore, side-by-side compare

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Download, RotateCcw, Columns2, X } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MediaVersion {
  id: string
  version_number: number
  size: number
  note: string | null
  created_at: string
  download_url: string
  mime_type?: string
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const versionApi = {
  list: (mediaId: string) =>
    api.get(`/media/${mediaId}/versions`).then((r) => r.data.data.versions as MediaVersion[]),
  restore: (mediaId: string, versionId: string) =>
    api.post(`/media/${mediaId}/versions/${versionId}/restore`),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── Compare view ─────────────────────────────────────────────────────────────

function CompareView({
  a,
  b,
  onClose,
}: {
  a: MediaVersion
  b: MediaVersion
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col">
      <div className="flex items-center justify-between p-3 bg-background/90 backdrop-blur">
        <span className="text-sm font-medium">
          Compare — v{a.version_number} vs v{b.version_number}
        </span>
        <button type="button" onClick={onClose} className="p-1 hover:bg-accent rounded">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 min-h-0 gap-px bg-muted">
        {[a, b].map((v) => (
          <div key={v.id} className="flex-1 flex flex-col overflow-hidden bg-background">
            <div className="text-xs text-center py-1 border-b bg-muted/40 font-medium">
              v{v.version_number} — {new Date(v.created_at).toLocaleString()}
              {v.note && <span className="text-muted-foreground ml-1">({v.note})</span>}
            </div>
            <div className="flex-1 flex items-center justify-center p-2 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.download_url}
                alt={`Version ${v.version_number}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface VersionHistoryPanelProps {
  mediaId: string
  mediaType?: string
  onRestored?: () => void
}

export function VersionHistoryPanel({ mediaId, mediaType, onRestored }: VersionHistoryPanelProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [comparing, setComparing] = useState<[MediaVersion, MediaVersion] | null>(null)

  const { data: versions, isLoading } = useQuery({
    queryKey: ['media-versions', mediaId],
    queryFn: () => versionApi.list(mediaId),
  })

  const restoreMut = useMutation({
    mutationFn: (versionId: string) => versionApi.restore(mediaId, versionId),
    onSuccess: () => {
      toast({ title: 'Version restored' })
      queryClient.invalidateQueries({ queryKey: ['media-versions', mediaId] })
      onRestored?.()
    },
    onError: () => toast({ title: 'Restore failed', variant: 'destructive' }),
  })

  const isImage = mediaType === 'IMAGE'

  const toggleSelect = (versionId: string) => {
    setSelected((prev) => {
      if (prev.includes(versionId)) return prev.filter((id) => id !== versionId)
      if (prev.length >= 2) return [prev[1]!, versionId]
      return [...prev, versionId]
    })
  }

  const handleCompare = () => {
    if (!versions || selected.length < 2) return
    const a = versions.find((v) => v.id === selected[0])
    const b = versions.find((v) => v.id === selected[1])
    if (a && b) setComparing([a, b])
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">Loading versions…</p>
  }

  if (!versions || versions.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No version history available.</p>
  }

  return (
    <>
      {comparing && (
        <CompareView a={comparing[0]} b={comparing[1]} onClose={() => setComparing(null)} />
      )}

      <div className="space-y-2">
        {isImage && selected.length === 2 && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" className="gap-1" onClick={handleCompare}>
              <Columns2 className="h-3.5 w-3.5" /> Compare selected
            </Button>
          </div>
        )}

        {versions.map((v, idx) => {
          const isCurrent = idx === 0
          const isChecked = selected.includes(v.id)

          return (
            <div
              key={v.id}
              className={cn(
                'border rounded-md p-3 space-y-1',
                isCurrent && 'border-primary/50 bg-primary/5',
                isChecked && 'ring-1 ring-primary'
              )}
            >
              <div className="flex items-center gap-2">
                {isImage && (
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(v.id)}
                    className="h-3.5 w-3.5 rounded"
                    title="Select for compare"
                  />
                )}
                <span className="text-sm font-medium">v{v.version_number}</span>
                {isCurrent && (
                  <Badge variant="default" className="text-xs px-1.5 py-0">Current</Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {formatBytes(v.size)}
                </span>
              </div>

              <p className="text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleString()}
              </p>

              {v.note && (
                <p className="text-xs italic text-muted-foreground">{v.note}</p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <a
                  href={v.download_url}
                  download
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border rounded px-2 py-1 hover:bg-accent transition-colors"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
                {!isCurrent && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={() => restoreMut.mutate(v.id)}
                    disabled={restoreMut.isPending}
                  >
                    <RotateCcw className="h-3 w-3" /> Restore
                  </Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}
