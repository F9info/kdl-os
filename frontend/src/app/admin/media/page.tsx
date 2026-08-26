'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Folder,
  FolderPlus,
  ChevronRight,
  Upload,
  Grid,
  List,
  Search,
  Trash2,
  Move,
  RefreshCcw,
  AlertTriangle,
  X,
  Eye,
  Pencil,
  Info,
  Cloud,
  Camera,
  Maximize2,
  Share2,
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { AppImage } from '@/components/shared/AppImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { LoadingState } from '@/components/ui/loading-state'
import { formatDate, formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type {
  Media,
  MediaFolder,
  MediaType,
  MediaUsage,
  MediaSearchResult,
  MediaSearchDoc,
} from '@/types/media.types'
import {
  SearchFacets,
  MediaTagChips,
  CustomFieldEditor,
  SidebarNav,
  CollectionsPanel,
  CollectionItemsView,
  FavoritesView,
  RecentsView,
  ChunkedUploadDialog,
  FolderUploadButton,
  useClipboardPaste,
  FavoriteButton,
  TagManager,
  damApi,
  type SidebarView,
} from '@/components/media/DamExtensions'
import {
  WebcamCaptureButton,
  ScreenCaptureButton,
  VoiceRecorderButton,
} from '@/components/media/CaptureWidgets'
import { CloudImportDialog } from '@/components/media/CloudImportDialog'
import { CaptureDialog } from '@/components/media/capture/CaptureDialog'
import { ImageEditorDialog } from '@/components/media/ImageEditorDialog'
import { ShareDialog } from '@/components/media/ShareDialog'
import { MediaLightbox } from '@/components/media/MediaLightbox'

// Mime types the backend image editor can actually process (KDL-153) — svg is
// vector-edited or rasterized server-side, the rest go through sharp directly.
// Formats outside this set (tiff, heic, …) would otherwise silently corrupt,
// so the Edit button stays hidden for them.
const EDITABLE_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/svg+xml',
])

// ── API helpers ──────────────────────────────────────────────────────────────

const mediaApi = {
  list: (params: Record<string, string>) => api.get('/media', { params }).then((r) => r.data.data),
  get: (id: string) => api.get(`/media/${id}`).then((r) => r.data.data.media as Media),
  folders: () => api.get('/media/folders').then((r) => r.data.data.folders as MediaFolder[]),
  trash: () => api.get('/media/trash').then((r) => r.data.data.media as Media[]),
  usage: (id: string) =>
    api.get(`/media/${id}/usage`).then((r) => r.data.data.usages as MediaUsage[]),
  createFolder: (data: { name: string; parent_id?: string | null }) =>
    api.post('/media/folders', data),
  renameFolder: (id: string, data: { name?: string; parent_id?: string | null }) =>
    api.patch(`/media/folders/${id}`, data),
  deleteFolder: (id: string, cascade = false) =>
    api.delete(`/media/folders/${id}${cascade ? '?cascade=true' : ''}`),
  upload: (files: File[], folderId?: string | null, visibility?: 'SHARED') => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    if (folderId) fd.append('folder_id', folderId)
    if (visibility) fd.append('visibility', visibility)
    return api
      .post<{ data: { media: Media[] } }>('/media/upload', fd)
      .then((r) => r.data.data.media)
  },
  update: (
    id: string,
    data: Partial<Pick<Media, 'title' | 'alt_text' | 'caption' | 'original_name' | 'visibility'>>
  ) => api.patch(`/media/${id}`, data),
  delete: (id: string) => api.delete(`/media/${id}`),
  bulkDelete: (media_ids: string[]) => api.post('/media/bulk-delete', { media_ids }),
  move: (media_ids: string[], folder_id: string | null) =>
    api.post('/media/move', { media_ids, folder_id }),
  restoreTrash: (media_ids: string[]) => api.post('/media/trash/restore', { media_ids }),
  purgeTrash: () => api.delete('/media/trash/purge'),
  purgeSingle: (id: string) => api.delete(`/media/trash/${id}`),
  touch: (id: string) => api.post(`/media/${id}/touch`).catch(() => {}),
  // Phase D — AI (endpoints 501/hidden when the feature has no active provider)
  aiStatus: () =>
    api
      .get('/media/ai/status')
      .then(
        (r) =>
          r.data.data.features as Record<string, { configured: boolean; driver: string | null }>
      ),
  analyze: (id: string) => api.post(`/media/${id}/analyze`),
  suggestions: (id: string) =>
    api.get(`/media/${id}/suggestions`).then((r) => r.data.data.items as MediaSuggestion[]),
  acceptSuggestion: (id: string) => api.post(`/media/suggestions/${id}/accept`),
  rejectSuggestion: (id: string) => api.post(`/media/suggestions/${id}/reject`),
  transcribe: (id: string) => api.post(`/media/${id}/transcribe`),
  transcript: (id: string) =>
    api.get(`/media/${id}/transcript`).then(
      (r) =>
        r.data.data as {
          text: string | null
          segments: TranscriptSegment[]
          language: string | null
        }
    ),
  aiImageOp: (id: string, op: 'bg-removal' | 'upscale' | 'enhance', scale?: number) =>
    api.post(`/media/${id}/ai-image-op`, { op, ...(scale ? { scale } : {}) }),
}

interface MediaSuggestion {
  id: string
  media_id: string
  type: 'TAGS' | 'TITLE' | 'DESCRIPTION' | 'ALT_TEXT' | 'SEO_KEYWORDS'
  value: string | string[]
  source: string
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
}

interface TranscriptSegment {
  start: number
  end: number
  text: string
}

// ── Folder tree ──────────────────────────────────────────────────────────────

function FolderNode({
  folder,
  depth,
  selectedId,
  onSelect,
  folders,
  onRename,
  onDelete,
}: {
  folder: MediaFolder
  depth: number
  selectedId: string | null | undefined
  onSelect: (id: string) => void
  folders: MediaFolder[]
  onRename: (folder: MediaFolder) => void
  onDelete: (folder: MediaFolder) => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const children = folders.filter((f) => f.parent_id === folder.id)

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 text-sm cursor-pointer hover:bg-accent group',
          selectedId === folder.id && 'bg-accent font-medium'
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        <button
          type="button"
          className="p-0 h-4 w-4 flex-shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((v) => !v)
          }}
        >
          {children.length > 0 ? (
            <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
          ) : (
            <span className="h-3 w-3 block" />
          )}
        </button>
        <button
          type="button"
          className="flex items-center gap-1.5 flex-1 text-left"
          onClick={() => onSelect(folder.id)}
        >
          <Folder className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
          <span className="truncate">{folder.name}</span>
          {folder._count && (
            <span className="text-xs text-muted-foreground ml-auto pr-1">
              {folder._count.media}
            </span>
          )}
        </button>
        <div className="hidden group-hover:flex items-center gap-0.5">
          <button
            type="button"
            className="p-0.5 hover:text-foreground text-muted-foreground rounded"
            onClick={() => onRename(folder)}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="p-0.5 hover:text-destructive text-muted-foreground rounded"
            onClick={() => onDelete(folder)}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {expanded &&
        children.map((c) => (
          <FolderNode
            key={c.id}
            folder={c}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            folders={folders}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
    </div>
  )
}

// ── Media item ────────────────────────────────────────────────────────────────

interface TrashRowActions {
  onRestore: (id: string) => void
  onDeleteForever: (id: string) => void
}

function MediaItemGrid({
  item,
  selected,
  onToggle,
  onDetail,
  onPreview,
  trashActions,
  processing,
  onManageShare,
}: {
  item: Media
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onDetail: (item: Media) => void
  onPreview: (item: Media) => void
  trashActions?: TrashRowActions
  processing?: boolean
  onManageShare: (item: Media) => void
}) {
  const { can } = usePermissions()
  const canPreview = can('media:preview')
  const thumb = item.variants?.thumb ?? (item.mime_type.startsWith('image/') ? item.url : null)
  return (
    <div
      className={cn(
        'relative border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-all',
        selected && 'border-primary ring-2 ring-primary/30'
      )}
      onClick={(e) => onToggle(item.id, e)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (canPreview) onPreview(item)
      }}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
        {thumb ? (
          <AppImage
            size="thumbnail"
            src={thumb}
            alt={item.original_name}
            className="max-h-full max-w-full"
          />
        ) : (
          <span className="text-2xl text-muted-foreground font-bold">{item.type[0]}</span>
        )}
        {processing && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="text-[10px] font-medium text-muted-foreground animate-pulse">
              Processing…
            </span>
          </div>
        )}
        {item.has_active_share && (
          <button
            type="button"
            title="Shared — manage or revoke links"
            onClick={(e) => {
              e.stopPropagation()
              onManageShare(item)
            }}
            className="absolute bottom-1 left-1 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90"
          >
            <Share2 className="h-2.5 w-2.5" /> Shared
          </button>
        )}
      </div>
      <div className="p-1.5">
        <p className="text-xs truncate font-medium">{item.title || item.original_name}</p>
        <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
      </div>
      <div className="absolute top-1 left-1">
        <input
          type="checkbox"
          checked={selected}
          readOnly
          className="h-4 w-4 rounded"
          onClick={(e) => {
            e.stopPropagation()
            onToggle(item.id, e as unknown as React.MouseEvent)
          }}
        />
      </div>
      <div className="absolute top-1 right-1 flex gap-0.5">
        {trashActions ? (
          <>
            {can('media:restore') && (
              <button
                type="button"
                title="Restore"
                className="p-0.5 bg-background/80 rounded hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation()
                  trashActions.onRestore(item.id)
                }}
              >
                <RefreshCcw className="h-3 w-3" />
              </button>
            )}
            {can('media:purge') && (
              <button
                type="button"
                title="Delete forever"
                className="p-0.5 bg-background/80 rounded hover:bg-background hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  trashActions.onDeleteForever(item.id)
                }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </>
        ) : (
          <>
            {canPreview && (
              <button
                type="button"
                title="Preview"
                className="p-0.5 bg-background/80 rounded hover:bg-background"
                onClick={(e) => {
                  e.stopPropagation()
                  onPreview(item)
                }}
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            )}
            <button
              type="button"
              title="Details"
              className="p-0.5 bg-background/80 rounded hover:bg-background"
              onClick={(e) => {
                e.stopPropagation()
                onDetail(item)
              }}
            >
              <Eye className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function MediaItemList({
  item,
  selected,
  onToggle,
  onDetail,
  onPreview,
  trashActions,
  processing,
  onManageShare,
}: {
  item: Media
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onDetail: (item: Media) => void
  onPreview: (item: Media) => void
  trashActions?: TrashRowActions
  processing?: boolean
  onManageShare: (item: Media) => void
}) {
  const { can } = usePermissions()
  const canPreview = can('media:preview')
  const thumb = item.variants?.thumb ?? (item.mime_type.startsWith('image/') ? item.url : null)
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-b hover:bg-accent/40 cursor-pointer',
        selected && 'bg-accent'
      )}
      onClick={(e) => onToggle(item.id, e)}
      onDoubleClick={(e) => {
        e.stopPropagation()
        if (canPreview) onPreview(item)
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        readOnly
        className="h-4 w-4 rounded"
        onClick={(e) => {
          e.stopPropagation()
          onToggle(item.id, e as unknown as React.MouseEvent)
        }}
      />
      {/* List rows are dense chrome: the 32px box crops the token-sized
          thumbnail via overflow-hidden rather than letting it set row height. */}
      <div className="h-8 w-8 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center relative">
        {thumb ? (
          <AppImage size="thumbnail" src={thumb} alt={item.original_name} />
        ) : (
          <span className="text-xs text-muted-foreground">{item.type[0]}</span>
        )}
        {processing && <div className="absolute inset-0 bg-background/70 animate-pulse" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm truncate font-medium">{item.title || item.original_name}</p>
          {item.has_active_share && (
            <button
              type="button"
              title="Shared — manage or revoke links"
              onClick={(e) => {
                e.stopPropagation()
                onManageShare(item)
              }}
              className="flex-shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90"
            >
              <Share2 className="h-2.5 w-2.5" /> Shared
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {item.mime_type} · {formatBytes(item.size)}
          {processing && <span className="ml-1 text-primary">· Processing…</span>}
        </p>
      </div>
      <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      {trashActions ? (
        <>
          {can('media:restore') && (
            <button
              type="button"
              title="Restore"
              onClick={(e) => {
                e.stopPropagation()
                trashActions.onRestore(item.id)
              }}
              className="p-1 hover:text-foreground text-muted-foreground"
            >
              <RefreshCcw className="h-4 w-4" />
            </button>
          )}
          {can('media:purge') && (
            <button
              type="button"
              title="Delete forever"
              onClick={(e) => {
                e.stopPropagation()
                trashActions.onDeleteForever(item.id)
              }}
              className="p-1 hover:text-destructive text-muted-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </>
      ) : (
        <>
          {canPreview && (
            <button
              type="button"
              title="Preview"
              onClick={(e) => {
                e.stopPropagation()
                onPreview(item)
              }}
              className="p-1 hover:text-foreground text-muted-foreground"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            title="Details"
            onClick={(e) => {
              e.stopPropagation()
              onDetail(item)
            }}
            className="p-1 hover:text-foreground text-muted-foreground"
          >
            <Info className="h-4 w-4" />
          </button>
        </>
      )}
    </div>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg px-4 py-2 text-center transition-colors cursor-pointer flex items-center gap-2',
        drag ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDrag(false)
        if (!disabled) onFiles(Array.from(e.dataTransfer.files))
      }}
      onClick={() => !disabled && inputRef.current?.click()}
    >
      <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <p className="text-sm text-muted-foreground">Upload</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
    </div>
  )
}

// ── AI panels (Phase D) ───────────────────────────────────────────────────────
// Hidden entirely when the matching AI feature has no active provider.

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function AiSuggestionsPanel({ item }: { item: Media }) {
  const queryClient = useQueryClient()
  const { data: suggestions } = useQuery({
    queryKey: ['media-suggestions', item.id],
    queryFn: () => mediaApi.suggestions(item.id),
  })

  const analyzeMutation = useMutation({
    mutationFn: () => mediaApi.analyze(item.id),
    onSuccess: () =>
      toast({
        title: 'Analysis queued',
        description: 'Suggestions appear here when ready.',
      }),
    onError: () => toast({ title: 'Analyze failed', variant: 'destructive' }),
  })

  const decideMutation = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) =>
      accept ? mediaApi.acceptSuggestion(id) : mediaApi.rejectSuggestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['media-suggestions', item.id],
      })
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
    onError: () => toast({ title: 'Action failed', variant: 'destructive' }),
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          AI Suggestions
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? 'Queuing…' : 'Analyze'}
        </Button>
      </div>
      {(suggestions ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No pending suggestions.</p>
      ) : (
        suggestions!.map((s) => (
          <div key={s.id} className="rounded border p-2 text-xs space-y-1">
            <p className="font-medium">{s.type.replace(/_/g, ' ')}</p>
            <p className="text-muted-foreground break-words">
              {Array.isArray(s.value) ? s.value.join(', ') : s.value}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => decideMutation.mutate({ id: s.id, accept: true })}
                disabled={decideMutation.isPending}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs"
                onClick={() => decideMutation.mutate({ id: s.id, accept: false })}
                disabled={decideMutation.isPending}
              >
                Reject
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function TranscriptPanel({ item }: { item: Media }) {
  const queryClient = useQueryClient()
  const { data: transcript } = useQuery({
    queryKey: ['media-transcript', item.id],
    queryFn: () => mediaApi.transcript(item.id).catch(() => null), // 404 until transcribed
  })

  const transcribeMutation = useMutation({
    mutationFn: () => mediaApi.transcribe(item.id),
    onSuccess: () => {
      toast({
        title: 'Transcription queued',
        description: 'The transcript appears here when ready.',
      })
      // Poll once after a while so a fast job shows up without a manual refresh
      setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: ['media-transcript', item.id],
          }),
        15_000
      )
    },
    onError: () => toast({ title: 'Transcribe failed', variant: 'destructive' }),
  })

  const apiBase = api.defaults.baseURL ?? '/api'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Captions
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => transcribeMutation.mutate()}
          disabled={transcribeMutation.isPending}
        >
          {transcribeMutation.isPending ? 'Queuing…' : transcript ? 'Re-transcribe' : 'Transcribe'}
        </Button>
      </div>
      {!transcript ? (
        <p className="text-xs text-muted-foreground">No transcript yet.</p>
      ) : (
        <>
          <div className="max-h-48 overflow-y-auto rounded border p-2 space-y-1">
            {transcript.segments.map((s, i) => (
              <p key={i} className="text-xs">
                <span className="text-muted-foreground font-mono mr-1">{formatTime(s.start)}</span>
                {s.text}
              </p>
            ))}
          </div>
          <div className="flex gap-3 text-xs">
            <a
              className="text-primary hover:underline"
              href={`${apiBase}/media/${item.id}/transcript?format=srt`}
            >
              Download SRT
            </a>
            <a
              className="text-primary hover:underline"
              href={`${apiBase}/media/${item.id}/transcript?format=vtt`}
            >
              Download VTT
            </a>
          </div>
        </>
      )}
    </div>
  )
}

function AiImageOpsPanel({ item }: { item: Media }) {
  const queryClient = useQueryClient()

  const opMutation = useMutation({
    mutationFn: (op: 'bg-removal' | 'upscale' | 'enhance') =>
      mediaApi.aiImageOp(item.id, op, op === 'upscale' ? 2 : undefined),
    onSuccess: () => {
      toast({
        title: 'AI edit queued',
        description: 'A new version appears in Version History when ready.',
      })
      setTimeout(
        () =>
          queryClient.invalidateQueries({
            queryKey: ['media-versions', item.id],
          }),
        15_000
      )
    },
    onError: () => toast({ title: 'AI edit failed', variant: 'destructive' }),
  })

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        AI Image Edits
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={() => opMutation.mutate('bg-removal')}
          disabled={opMutation.isPending}
        >
          Remove background
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={() => opMutation.mutate('upscale')}
          disabled={opMutation.isPending}
        >
          Upscale 2x
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs"
          onClick={() => opMutation.mutate('enhance')}
          disabled={opMutation.isPending}
        >
          Enhance
        </Button>
      </div>
      {/* Object-removal needs a mask drawn in the editor — deferred, see STATUS.md D6 notes */}
    </div>
  )
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  item,
  onClose,
  onDeleted,
  onUpdated,
  onPreview,
  processing,
  onEditJobStarted,
}: {
  item: Media
  onClose: () => void
  onDeleted: () => void
  onUpdated: (mediaId: string) => void
  onPreview: () => void
  processing?: boolean
  onEditJobStarted: (mediaId: string, jobId: string) => void
}) {
  const { can } = usePermissions()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(item.title ?? '')
  const [altText, setAltText] = useState(item.alt_text ?? '')
  const [caption, setCaption] = useState(item.caption ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)

  const { data: usages } = useQuery({
    queryKey: ['media-usage', item.id],
    queryFn: () => mediaApi.usage(item.id),
  })

  // A8: favorite star needs to know if THIS item is already favorited — it
  // previously always rendered as "not favorited".
  const { data: favorites } = useQuery({
    queryKey: ['media-favorites'],
    queryFn: damApi.listFavorites,
  })
  const isFav = (favorites ?? []).some((f) => f.id === item.id)

  // Phase D: feature flags — unconfigured AI features stay hidden
  const { data: aiStatus } = useQuery({
    queryKey: ['media-ai-status'],
    queryFn: () =>
      mediaApi
        .aiStatus()
        .catch(() => ({}) as Record<string, { configured: boolean; driver: string | null }>),
    staleTime: 60_000,
  })
  const isImage = item.mime_type.startsWith('image/')
  const canEditImage = EDITABLE_IMAGE_MIMES.has(item.mime_type)
  const isAv = item.mime_type.startsWith('video/') || item.mime_type.startsWith('audio/')
  const showAnalyze = isImage && aiStatus?.vision?.configured
  const showTranscribe = isAv && aiStatus?.speech_to_text?.configured
  const showImageOps = isImage && aiStatus?.image_ops?.configured

  const updateMutation = useMutation({
    mutationFn: () => mediaApi.update(item.id, { title, alt_text: altText, caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({ title: 'Saved' })
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  })

  // KDL-150: private⇄shared toggle
  const visibilityMutation = useMutation({
    mutationFn: (visibility: 'PRIVATE' | 'SHARED') => mediaApi.update(item.id, { visibility }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      // `item` here is the drawer's own prop snapshot, not derived from the
      // ['media'] query — invalidation alone leaves the toggle label stale.
      onUpdated(item.id)
    },
    onError: () => toast({ title: 'Failed to change visibility', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => mediaApi.delete(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      onDeleted()
      onClose()
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Delete failed'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  return (
    <div
      className="fixed right-0 w-80 bg-background border-l shadow-xl z-30 overflow-y-auto p-4 space-y-4"
      style={{
        top: 'var(--th-layout-header-height)',
        height: 'calc(100% - var(--th-layout-header-height))',
      }}
    >
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">File Details</h3>
        <button type="button" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {item.url && can('media:preview') && (
        <button
          type="button"
          onClick={onPreview}
          className="w-full block"
          title="Open full preview"
        >
          {item.mime_type.startsWith('image/') ? (
            <AppImage
              size="content"
              src={item.url}
              alt={item.original_name}
              className="max-w-full rounded border hover:opacity-90"
            />
          ) : (
            <span className="flex items-center justify-center h-24 rounded border bg-muted text-xs text-muted-foreground hover:bg-accent">
              Open preview
            </span>
          )}
        </button>
      )}

      {isImage && !canEditImage && item.url && can('media:edit-image') && (
        <p className="text-xs text-muted-foreground text-center">
          Editing isn&apos;t supported for {item.mime_type} files
        </p>
      )}
      {processing && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Processing edit… this will update automatically.
        </p>
      )}
      {isImage && canEditImage && item.url && can('media:edit-image') && (
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          disabled={processing}
          onClick={() => setEditorOpen(true)}
        >
          {processing ? 'Processing…' : 'Edit image (crop, resize, rotate…)'}
        </Button>
      )}
      {isImage && canEditImage && item.url && can('media:edit-image') && (
        <ImageEditorDialog
          mediaId={item.id}
          mediaUrl={item.url}
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          onSaved={(jobId) => onEditJobStarted(item.id, jobId)}
        />
      )}

      {/* KDL-148: this button + dialog existed but were never rendered anywhere
          in the app, so there was no way to create or copy a share link. */}
      {can('media:share-link') && (
        <>
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            onClick={() => setShareOpen(true)}
          >
            {item.has_active_share && (
              <Badge className="h-4 px-1 text-[10px] leading-none">Shared</Badge>
            )}
            Share / copy link{item.has_active_share ? ' / revoke' : ''}
          </Button>
          <ShareDialog
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            mediaId={item.id}
            mediaName={item.original_name}
          />
        </>
      )}

      {can('media:visibility-toggle') && (
        <div className="flex items-center justify-between rounded border px-2 py-1.5">
          <span className="text-xs text-muted-foreground">
            {item.visibility === 'SHARED' ? 'Shared with all users' : 'Private (only you)'}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() =>
              visibilityMutation.mutate(item.visibility === 'SHARED' ? 'PRIVATE' : 'SHARED')
            }
            disabled={visibilityMutation.isPending}
          >
            Make {item.visibility === 'SHARED' ? 'private' : 'shared'}
          </Button>
        </div>
      )}

      {can('media:metadata-edit') && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Metadata
          </p>
          <label className="block text-sm">
            Title
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </label>
          <label className="block text-sm">
            Alt text
            <Input
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </label>
          <label className="block text-sm">
            Caption
            <Input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="mt-1 h-8 text-sm"
            />
          </label>
          <Button
            size="sm"
            className="w-full"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            Save metadata
          </Button>
        </div>
      )}

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>
          File: <span className="text-foreground">{item.original_name}</span>
        </p>
        <p>
          Size: <span className="text-foreground">{formatBytes(item.size)}</span>
        </p>
        <p>
          Type: <span className="text-foreground">{item.mime_type}</span>
        </p>
        {item.width && item.height && (
          <p>
            Dimensions:{' '}
            <span className="text-foreground">
              {item.width}×{item.height}px
            </span>
          </p>
        )}
        <p>
          Uploaded: <span className="text-foreground">{formatDate(item.created_at)}</span>
        </p>
      </div>

      {item.variants && Object.values(item.variants).some(Boolean) && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Variants
          </p>
          {Object.entries(item.variants)
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <a
                key={k}
                href={v!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary block hover:underline"
              >
                {k}
              </a>
            ))}
        </div>
      )}

      {/* A8: tag chips */}
      {can('media:tags') && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tags</p>
          <MediaTagChips
            mediaId={item.id}
            tags={item.tags ?? []}
            onChange={() => queryClient.invalidateQueries({ queryKey: ['media'] })}
          />
        </div>
      )}

      {/* A8: custom meta fields */}
      {can('media:custom-fields') && (
        <CustomFieldEditor
          mediaId={item.id}
          meta={item.meta ?? {}}
          onChange={() => queryClient.invalidateQueries({ queryKey: ['media'] })}
        />
      )}

      {/* A8: favorite toggle */}
      {can('media:favorites') && (
        <div className="flex items-center gap-2">
          <FavoriteButton
            mediaId={item.id}
            isFav={isFav}
            onChange={() => {
              queryClient.invalidateQueries({ queryKey: ['media-favorites'] })
            }}
          />
          <span className="text-xs text-muted-foreground">Favorite</span>
        </div>
      )}

      {showAnalyze && <AiSuggestionsPanel item={item} />}
      {showTranscribe && <TranscriptPanel item={item} />}
      {showImageOps && <AiImageOpsPanel item={item} />}

      {usages && usages.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Used by
          </p>
          {usages.map((u) => (
            <Badge key={u.id} variant="secondary" className="text-xs mr-1">
              {u.entity}
            </Badge>
          ))}
        </div>
      )}

      {can('media:soft-delete') && (
        <>
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => setConfirmDelete(true)}
            disabled={deleteMutation.isPending || (usages?.length ?? 0) > 0}
          >
            {(usages?.length ?? 0) > 0 ? 'In use — cannot delete' : 'Delete file'}
          </Button>

          <ConfirmDialog
            open={confirmDelete}
            onClose={() => setConfirmDelete(false)}
            onConfirm={() => deleteMutation.mutate()}
            title="Delete file?"
            description="This will move the file to trash."
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = 'files' | 'trash'

type MediaScope = 'mine' | 'shared' | 'all'

export default function MediaPage() {
  const { can } = usePermissions()
  const queryClient = useQueryClient()

  const [view, setView] = useState<ViewMode>('files')
  const [sidebarView, setSidebarView] = useState<SidebarView>('folders')
  const [gridMode, setGridMode] = useState<'grid' | 'list'>('grid')
  const [scope, setScope] = useState<MediaScope>('all')
  const [selectedFolder, setSelectedFolder] = useState<string | null | undefined>(undefined)
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<MediaType | ''>('')
  const [searchResults, setSearchResults] = useState<MediaSearchResult | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailItem, setDetailItem] = useState<Media | null>(null)
  // KDL-172: separate sets for upload thumbnail wait vs active edit jobs so the
  // drawer doesn't show "Processing edit…" during the post-upload thumbnail window.
  const [uploadingMediaIds, setUploadingMediaIds] = useState<Set<string>>(new Set())
  const [processingEditIds, setProcessingEditIds] = useState<Set<string>>(new Set())
  const editPollIntervals = useRef<Set<ReturnType<typeof setInterval>>>(new Set())
  const deferredTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set())
  useEffect(
    () => () => {
      editPollIntervals.current.forEach(clearInterval)
      deferredTimers.current.forEach(clearTimeout)
    },
    []
  )
  const [lightboxItem, setLightboxItem] = useState<Media | null>(null)
  // KDL-172: clicking a file's "Shared" badge opens share management/revoke
  // directly, without needing to open the full File Details drawer first.
  const [shareTarget, setShareTarget] = useState<Media | null>(null)
  const [lastClickIdx, setLastClickIdx] = useState<number | null>(null)
  // A8: chunked upload dialog
  const [chunkedFiles, setChunkedFiles] = useState<File[]>([])
  const [chunkedOpen, setChunkedOpen] = useState(false)
  // A8: folder upload — uses existing backend /media/upload?relative_paths=...
  const handleFolderUpload = useCallback(
    (files: File[], relativePaths: string[]) => {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      relativePaths.forEach((p) => fd.append('relative_paths', p))
      if (selectedFolder) fd.append('folder_id', selectedFolder)
      api
        .post('/media/upload', fd)
        .then(() => {
          invalidateAll()
          toast({ title: 'Folder uploaded' })
        })
        .catch(() => toast({ title: 'Folder upload failed', variant: 'destructive' }))
    },
    [selectedFolder]
  )

  // D8: cloud import + capture dialogs
  const [cloudImportOpen, setCloudImportOpen] = useState(false)
  const [captureOpen, setCaptureOpen] = useState(false)

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameFolderTarget, setRenameFolderTarget] = useState<MediaFolder | null>(null)
  const [renameFolderName, setRenameFolderName] = useState('')
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveTargetFolder, setMoveTargetFolder] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [confirmPurge, setConfirmPurge] = useState(false)

  const debouncedSearch = useDebounce(search, 300)

  // ── Queries ─────────────────────────────────────────────────────────────────

  const foldersQuery = useQuery({
    queryKey: ['media-folders'],
    queryFn: mediaApi.folders,
  })
  const folders = foldersQuery.data ?? []
  // KDL-172: uploads silently land in whatever folder happened to be
  // selected, with no indication of where — surface it next to Upload.
  const uploadDestinationName = selectedFolder
    ? (folders.find((f) => f.id === selectedFolder)?.name ?? 'Selected folder')
    : 'Root (no folder)'

  // Phase D5: the search bar's semantic-mode toggle stays hidden until an
  // embeddings AI provider is configured (mirrors the per-item aiStatus gate
  // used for Analyze/Transcribe elsewhere on this page).
  const { data: searchAiStatus } = useQuery({
    queryKey: ['media-ai-status'],
    queryFn: () =>
      mediaApi
        .aiStatus()
        .catch(() => ({}) as Record<string, { configured: boolean; driver: string | null }>),
    staleTime: 60_000,
  })
  const semanticSearchEnabled = Boolean(searchAiStatus?.embeddings?.configured)

  const mediaParams: Record<string, string> = { limit: '50', scope }
  if (selectedFolder !== undefined)
    mediaParams.folder_id = selectedFolder === null ? 'null' : selectedFolder
  if (debouncedSearch) mediaParams.search = debouncedSearch
  if (typeFilter) mediaParams.type = typeFilter

  const mediaQuery = useQuery({
    queryKey: ['media', mediaParams],
    queryFn: () => mediaApi.list(mediaParams),
    enabled: view === 'files',
  })

  const trashQuery = useQuery({
    queryKey: ['media-trash'],
    queryFn: mediaApi.trash,
    enabled: view === 'trash',
  })

  // KDL-172: shared entry point for any "files arrived from outside the app"
  // source (paste, the toolbar Upload dropzone, drag-and-drop onto the grid) —
  // large files route to the chunked-upload flow, everything else uploads
  // straight into whatever folder is currently selected.
  const handleIncomingFiles = useCallback((files: File[]) => {
    const large = files.filter((f) => f.size > 50 * 1024 * 1024)
    const small = files.filter((f) => f.size <= 50 * 1024 * 1024)
    if (small.length) uploadMutation.mutate(small)
    if (large.length) {
      setChunkedFiles(large)
      setChunkedOpen(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A8: clipboard paste — attach images/files pasted anywhere on the page
  useClipboardPaste(handleIncomingFiles, can('media:upload'))

  // KDL-172: drag-and-drop onto the library grid. Tracks an enter/leave
  // counter (not a plain boolean) because the grid has nested children —
  // dragging over a child fires dragleave on the parent before dragenter on
  // the child, which would otherwise flicker the overlay off mid-drag.
  const [gridDragActive, setGridDragActive] = useState(false)
  const dragDepth = useRef(0)
  const gridDragHandlers =
    can('media:upload') && view === 'files'
      ? {
          onDragEnter: (e: React.DragEvent) => {
            e.preventDefault()
            dragDepth.current += 1
            setGridDragActive(true)
          },
          onDragOver: (e: React.DragEvent) => e.preventDefault(),
          onDragLeave: (e: React.DragEvent) => {
            e.preventDefault()
            dragDepth.current = Math.max(0, dragDepth.current - 1)
            if (dragDepth.current === 0) setGridDragActive(false)
          },
          onDrop: (e: React.DragEvent) => {
            e.preventDefault()
            dragDepth.current = 0
            setGridDragActive(false)
            if (e.dataTransfer.files.length) handleIncomingFiles(Array.from(e.dataTransfer.files))
          },
        }
      : {}

  // A8: open detail by id — search hits / collection docs lack url+variants, so
  // fetch the full row before showing the drawer
  const openDetailById = useCallback((mediaId: string) => {
    mediaApi
      .get(mediaId)
      .then(setDetailItem)
      .catch(() => toast({ title: 'Failed to load file', variant: 'destructive' }))
  }, [])

  // A8: items — search hits are flat Meili docs; map to Media-ish rows for the
  // grid (no url/variants → letter tile fallback, click fetches the full row)
  const docToMedia = (d: MediaSearchDoc): Media => ({
    id: d.id,
    user_id: d.owner_id,
    folder_id: d.folder_id,
    filename: d.name,
    original_name: d.name,
    mime_type: d.mime_type,
    size: d.size,
    bucket: '',
    path: '',
    url: null,
    title: d.title,
    alt_text: d.alt,
    caption: d.caption,
    width: d.width,
    height: d.height,
    duration: null,
    variants: null,
    type: d.type,
    visibility: d.visibility,
    deleted_at: null,
    created_at: d.created_at,
    updated_at: d.created_at,
    checksum: null,
    scan_result: null,
    scanned_at: null,
    exif: null,
    is_archived: d.is_archived,
    tags: d.tags,
    meta: d.meta,
  })
  const items: Media[] = searchResults
    ? searchResults.hits.map(docToMedia)
    : view === 'files'
      ? (mediaQuery.data?.media ?? [])
      : (trashQuery.data ?? [])

  // When search is active the grid rows are doc stubs — fetch full row on click
  const handleDetail = useCallback(
    (m: Media) => {
      mediaApi.touch(m.id)
      if (searchResults) openDetailById(m.id)
      else setDetailItem(m)
    },
    [searchResults, openDetailById]
  )

  // Search hits lack `url`/`variants` — fetch the full row before opening the
  // lightbox so it always has a real file to render.
  const handlePreview = useCallback(
    (m: Media) => {
      mediaApi.touch(m.id)
      if (searchResults || !m.url) {
        mediaApi
          .get(m.id)
          .then(setLightboxItem)
          .catch(() => toast({ title: 'Failed to load file', variant: 'destructive' }))
      } else {
        setLightboxItem(m)
      }
    },
    [searchResults]
  )

  // ── Mutations ────────────────────────────────────────────────────────────────

  // KDL-172: image edits run as an async job — invalidating the media query
  // right when the job is *queued* just refetches the pre-edit row, which is
  // what made edits look like a silent no-op until a manual page refresh.
  // Poll the job and only refresh once it has actually finished.
  const scheduleInvalidate = useCallback(
    (ms: number, extraId?: string) => {
      const id = setTimeout(() => {
        deferredTimers.current.delete(id)
        queryClient.invalidateQueries({ queryKey: ['media'] })
        // If the drawer is open for this item, pull the latest row so late-landing
        // variants show up without requiring a manual close-and-reopen.
        if (extraId) {
          setDetailItem((cur) => {
            if (cur?.id === extraId)
              mediaApi
                .get(extraId)
                .then(setDetailItem)
                .catch(() => {})
            return cur
          })
        }
      }, ms)
      deferredTimers.current.add(id)
    },
    [queryClient]
  )

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['media'] })
    queryClient.invalidateQueries({ queryKey: ['media-folders'] })
    queryClient.invalidateQueries({ queryKey: ['media-trash'] })
    // Thumbnail/preview variants are generated by an async worker after the
    // upload response returns — re-fetch once they've had time to land so
    // previews don't stay blank until the next unrelated refetch.
    scheduleInvalidate(3_000)
    scheduleInvalidate(8_000)
  }

  const pollEditJob = useCallback(
    (mediaId: string, jobId: string) => {
      setProcessingEditIds((prev) => new Set(prev).add(mediaId))
      const stop = () => {
        clearInterval(interval)
        editPollIntervals.current.delete(interval)
        setProcessingEditIds((prev) => {
          const next = new Set(prev)
          next.delete(mediaId)
          return next
        })
      }
      const interval = setInterval(async () => {
        try {
          const res = await api.get<{
            data: { state: string; failedReason: string | null }
          }>(`/media/jobs/${jobId}`)
          const { state, failedReason } = res.data.data
          if (state === 'completed') {
            stop()
            queryClient.invalidateQueries({ queryKey: ['media'] })
            // Thumbnail generation is a separate async step after the edit job
            // completes — schedule deferred refetches to pick up variants once
            // the thumbnail worker has had time to run. Pass mediaId so the open
            // drawer is refreshed even for the deferred ticks (Fix 4).
            scheduleInvalidate(3_000, mediaId)
            scheduleInvalidate(8_000, mediaId)
            // Immediate refresh of the open File Details row — it's a state
            // snapshot, not derived from the ['media'] query.
            setDetailItem((cur) => {
              if (cur?.id === mediaId)
                mediaApi
                  .get(mediaId)
                  .then(setDetailItem)
                  .catch(() => {})
              return cur
            })
            toast({ title: 'Edit applied' })
          } else if (state === 'failed') {
            stop()
            toast({
              title: 'Edit failed',
              description: failedReason ?? undefined,
              variant: 'destructive',
            })
          }
        } catch {
          stop()
          toast({
            title: 'Failed to check edit status',
            variant: 'destructive',
          })
        }
      }, 1500)
      editPollIntervals.current.add(interval)
    },
    [queryClient, scheduleInvalidate]
  )

  const uploadMutation = useMutation({
    // Uploading while the Shared tab is active lands the file shared —
    // otherwise there's no way to get a new upload into Shared without a
    // separate manual "Make shared" step afterward.
    mutationFn: (files: File[]) =>
      mediaApi.upload(files, selectedFolder ?? null, scope === 'shared' ? 'SHARED' : undefined),
    onSuccess: (uploaded) => {
      invalidateAll()
      toast({ title: 'Upload complete' })
      // Track IDs in uploadingMediaIds so the grid card shows "Processing…"
      // while the async thumbnail worker generates variants. Uses a separate set
      // from processingEditIds so the drawer never shows "Processing edit…" for
      // an item that was just uploaded (KDL-232 Fix 1).
      const ids = (uploaded ?? []).map((m) => m.id)
      if (ids.length > 0) {
        setUploadingMediaIds((prev) => {
          const next = new Set(prev)
          ids.forEach((id) => next.add(id))
          return next
        })
        const clearId = setTimeout(() => {
          deferredTimers.current.delete(clearId)
          setUploadingMediaIds((prev) => {
            const next = new Set(prev)
            ids.forEach((id) => next.delete(id))
            return next
          })
        }, 10_000)
        deferredTimers.current.add(clearId)
        // Third invalidation at ~10s closes the gap between the 8s last-refetch
        // and the 10s overlay — slow workers whose thumbnail lands in that window
        // get a final pickup (KDL-232 Fix 2).
        scheduleInvalidate(3_000)
        scheduleInvalidate(8_000)
        scheduleInvalidate(10_000)
      }
    },
    onError: () => toast({ title: 'Upload failed', variant: 'destructive' }),
  })

  const createFolderMutation = useMutation({
    mutationFn: () =>
      mediaApi.createFolder({
        name: newFolderName,
        parent_id: selectedFolder ?? null,
      }),
    onSuccess: () => {
      invalidateAll()
      setCreateFolderOpen(false)
      setNewFolderName('')
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const renameFolderMutation = useMutation({
    mutationFn: () => mediaApi.renameFolder(renameFolderTarget!.id, { name: renameFolderName }),
    onSuccess: () => {
      invalidateAll()
      setRenameFolderTarget(null)
    },
    onError: () => toast({ title: 'Rename failed', variant: 'destructive' }),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (cascade: boolean) => mediaApi.deleteFolder(deleteFolderTarget!.id, cascade),
    onSuccess: () => {
      invalidateAll()
      setDeleteFolderTarget(null)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => mediaApi.bulkDelete(Array.from(selected)),
    onSuccess: () => {
      invalidateAll()
      setSelected(new Set())
      setConfirmBulkDelete(false)
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Some files are in use'
      toast({ title: msg, variant: 'destructive' })
      setConfirmBulkDelete(false)
    },
  })

  const moveMutation = useMutation({
    mutationFn: () => mediaApi.move(Array.from(selected), moveTargetFolder),
    onSuccess: () => {
      invalidateAll()
      setSelected(new Set())
      setMoveOpen(false)
    },
    onError: () => toast({ title: 'Move failed', variant: 'destructive' }),
  })

  // KDL-172 — bulk "Make shared", since there's otherwise no way to mark
  // files as Shared except opening each one's File Details individually.
  const bulkShareMutation = useMutation({
    mutationFn: () =>
      Promise.all(Array.from(selected).map((id) => mediaApi.update(id, { visibility: 'SHARED' }))),
    onSuccess: () => {
      invalidateAll()
      setSelected(new Set())
      toast({ title: 'Marked as shared' })
    },
    onError: () => toast({ title: 'Failed to mark as shared', variant: 'destructive' }),
  })

  const restoreMutation = useMutation({
    mutationFn: () => mediaApi.restoreTrash(Array.from(selected)),
    onSuccess: () => {
      invalidateAll()
      setSelected(new Set())
    },
    onError: () => toast({ title: 'Restore failed', variant: 'destructive' }),
  })

  const restoreOneMutation = useMutation({
    mutationFn: (id: string) => mediaApi.restoreTrash([id]),
    onSuccess: () => {
      invalidateAll()
      toast({ title: 'File restored' })
    },
    onError: () => toast({ title: 'Restore failed', variant: 'destructive' }),
  })

  const [deleteForeverTarget, setDeleteForeverTarget] = useState<string | null>(null)
  const deleteForeverMutation = useMutation({
    mutationFn: (id: string) => mediaApi.purgeSingle(id),
    onSuccess: () => {
      invalidateAll()
      setDeleteForeverTarget(null)
      toast({ title: 'File permanently deleted' })
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  })

  const purgeMutation = useMutation({
    mutationFn: mediaApi.purgeTrash,
    onSuccess: () => {
      invalidateAll()
      setConfirmPurge(false)
      toast({ title: 'Trash purged' })
    },
    onError: () => toast({ title: 'Purge failed', variant: 'destructive' }),
  })

  // ── Selection ────────────────────────────────────────────────────────────────

  const handleToggle = useCallback(
    (id: string, e: React.MouseEvent) => {
      const idx = items.findIndex((m) => m.id === id)
      setSelected((prev) => {
        const next = new Set(prev)
        if (e.shiftKey && lastClickIdx !== null) {
          const lo = Math.min(idx, lastClickIdx)
          const hi = Math.max(idx, lastClickIdx)
          items.slice(lo, hi + 1).forEach((m) => next.add(m.id))
        } else {
          if (next.has(id)) next.delete(id)
          else next.add(id)
        }
        return next
      })
      setLastClickIdx(idx)
    },
    [items, lastClickIdx]
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  const rootFolders = folders.filter((f) => f.parent_id === null)
  const trashCount = (trashQuery.data ?? []).length

  return (
    <PermissionGuard permission="media:view">
      <div className="flex h-[calc(100vh-var(--th-layout-header-height))] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r flex flex-col bg-background">
          <SidebarNav
            current={sidebarView}
            onChange={(v) => {
              setSidebarView(v)
              if (v !== 'collections') setSelectedCollection(null)
            }}
            visible={[
              'folders',
              ...(can('media:collections') ? (['collections'] as const) : []),
              ...(can('media:favorites') ? (['favorites'] as const) : []),
              'recents',
            ]}
          />

          {sidebarView === 'folders' && (
            <>
              <div className="p-2 border-b flex items-center justify-between">
                <span className="text-sm font-medium">Folders</span>
                {can('media:folders') && (
                  <button
                    type="button"
                    title="New folder"
                    onClick={() => setCreateFolderOpen(true)}
                    className="p-1 rounded hover:bg-accent"
                  >
                    <FolderPlus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
                <button
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded px-2 py-1 text-sm w-full hover:bg-accent',
                    selectedFolder === undefined && view === 'files' && 'bg-accent font-medium'
                  )}
                  onClick={() => {
                    setView('files')
                    setSelectedFolder(undefined)
                  }}
                >
                  <Grid className="h-3.5 w-3.5" />
                  All files
                </button>
                {rootFolders.map((f) => (
                  <FolderNode
                    key={f.id}
                    folder={f}
                    depth={0}
                    selectedId={selectedFolder}
                    onSelect={(id) => {
                      setSelectedFolder(id)
                      setView('files')
                    }}
                    folders={folders}
                    onRename={(folder) => {
                      setRenameFolderTarget(folder)
                      setRenameFolderName(folder.name)
                    }}
                    onDelete={setDeleteFolderTarget}
                  />
                ))}
              </div>
              {can('media:trash-view') && (
                <div className="border-t p-1">
                  <button
                    type="button"
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1 text-sm w-full hover:bg-accent',
                      view === 'trash' && 'bg-accent font-medium'
                    )}
                    onClick={() => {
                      setView('trash')
                      setSelected(new Set())
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Trash
                    {trashCount > 0 && (
                      <Badge variant="secondary" className="ml-auto text-xs px-1">
                        {trashCount}
                      </Badge>
                    )}
                  </button>
                </div>
              )}
            </>
          )}

          {sidebarView === 'collections' && (
            <CollectionsPanel
              selected={selectedCollection}
              onSelect={(id) => {
                setSelectedCollection(id)
                setView('files')
              }}
            />
          )}

          {/* favorites + recents: no sidebar content needed — main area shows them */}
          {(sidebarView === 'favorites' || sidebarView === 'recents') && (
            <div className="flex-1 flex items-center justify-center p-4 text-xs text-muted-foreground">
              Select a file to see details
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-3 pt-3 shrink-0">
            <PageHeader title="Media Library" />
          </div>
          {/* Toolbar */}
          <div className="p-3 border-b flex items-center gap-2 flex-wrap bg-background">
            {view === 'files' && (
              <>
                {can('media:upload') && (
                  <>
                    <UploadZone onFiles={handleIncomingFiles} disabled={uploadMutation.isPending} />
                    <FolderUploadButton
                      onFiles={handleFolderUpload}
                      disabled={uploadMutation.isPending}
                    />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Uploading to:{' '}
                      <span className="font-medium text-foreground">{uploadDestinationName}</span>
                    </span>
                  </>
                )}
                {can('media:folders') && (
                  <button
                    type="button"
                    onClick={() => setCreateFolderOpen(true)}
                    className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
                    title="New folder"
                  >
                    <Folder className="h-4 w-4" /> Folder
                  </button>
                )}
                {/* D8: cloud import + capture entry points */}
                {can('media:cloud-import') && (
                  <button
                    type="button"
                    onClick={() => setCloudImportOpen(true)}
                    className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
                    title="Import from cloud"
                  >
                    <Cloud className="h-4 w-4" /> Cloud
                  </button>
                )}
                {can('media:capture') && (
                  <>
                    <button
                      type="button"
                      onClick={() => setCaptureOpen(true)}
                      className="flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors"
                      title="Capture media"
                    >
                      <Camera className="h-4 w-4" /> Capture
                    </button>
                    <WebcamCaptureButton
                      onCapture={(file) => uploadMutation.mutate([file])}
                      disabled={uploadMutation.isPending}
                    />
                    <ScreenCaptureButton
                      onCapture={(file) => uploadMutation.mutate([file])}
                      disabled={uploadMutation.isPending}
                    />
                    <VoiceRecorderButton
                      onCapture={(file) => uploadMutation.mutate([file])}
                      disabled={uploadMutation.isPending}
                    />
                  </>
                )}
                <SearchFacets
                  onResults={(r) => setSearchResults(r)}
                  onClear={() => setSearchResults(null)}
                  semanticEnabled={semanticSearchEnabled}
                />
                {/* KDL-150: My / Shared / All — 'All' means "everything I can
                    see" (own + shared) for a regular user, and literally every
                    file for Super Admin, per the backend scope semantics. */}
                <div className="flex items-center rounded border overflow-hidden text-sm flex-shrink-0">
                  {(['mine', 'shared', 'all'] as MediaScope[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={cn(
                        'px-2.5 h-9 capitalize',
                        scope === s ? 'bg-accent font-medium' : 'hover:bg-accent/50'
                      )}
                    >
                      {s === 'mine' ? 'My files' : s}
                    </button>
                  ))}
                </div>
              </>
            )}

            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                {view === 'files' ? (
                  <>
                    {can('media:folders') && (
                      <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
                        <Move className="h-3.5 w-3.5 mr-1" />
                        Move
                      </Button>
                    )}
                    {can('media:visibility-toggle') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => bulkShareMutation.mutate()}
                        disabled={bulkShareMutation.isPending}
                      >
                        <Share2 className="h-3.5 w-3.5 mr-1" />
                        Make shared
                      </Button>
                    )}
                    {can('media:soft-delete') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmBulkDelete(true)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Delete
                      </Button>
                    )}
                  </>
                ) : (
                  can('media:restore') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate()}
                      disabled={restoreMutation.isPending}
                    >
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" />
                      Restore
                    </Button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="p-1 rounded hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="ml-auto flex items-center gap-1">
              {view === 'trash' && can('media:purge') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmPurge(true)}
                  disabled={trashCount === 0}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Purge all
                </Button>
              )}
              <button
                type="button"
                onClick={() => setGridMode('grid')}
                className={cn(
                  'p-1.5 rounded',
                  gridMode === 'grid' ? 'bg-accent' : 'hover:bg-accent'
                )}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGridMode('list')}
                className={cn(
                  'p-1.5 rounded',
                  gridMode === 'list' ? 'bg-accent' : 'hover:bg-accent'
                )}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Files area */}
          <div className="flex-1 overflow-y-auto p-3 relative" {...gridDragHandlers}>
            {gridDragActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-md pointer-events-none">
                <p className="text-sm font-medium text-primary bg-background/90 px-4 py-2 rounded shadow">
                  Drop files to upload to: {uploadDestinationName}
                </p>
              </div>
            )}
            {/* A8: collection / favorites / recents special views */}
            {sidebarView === 'collections' && selectedCollection && (
              <CollectionItemsView collectionId={selectedCollection} onDetail={openDetailById} />
            )}
            {sidebarView === 'favorites' && <FavoritesView onDetail={openDetailById} />}
            {sidebarView === 'recents' && <RecentsView onDetail={openDetailById} />}

            {/* Regular file grid (folders view or when no special view active) */}
            {(sidebarView === 'folders' ||
              (sidebarView === 'collections' && !selectedCollection)) && (
              <>
                {mediaQuery.error || trashQuery.error ? (
                  <ErrorState
                    error={mediaQuery.error ?? trashQuery.error}
                    onRetry={() => (view === 'trash' ? trashQuery.refetch() : mediaQuery.refetch())}
                  />
                ) : mediaQuery.isLoading || trashQuery.isLoading ? (
                  <LoadingState variant="skeleton" rows={6} />
                ) : items.length === 0 ? (
                  <EmptyState
                    title={view === 'trash' ? 'Trash is empty' : 'No files here'}
                    description={
                      view === 'trash' ? undefined : 'Upload a file or drag one onto this window.'
                    }
                  />
                ) : gridMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {items.map((item) => (
                      <MediaItemGrid
                        key={item.id}
                        item={item}
                        selected={selected.has(item.id)}
                        onToggle={handleToggle}
                        onDetail={handleDetail}
                        onPreview={handlePreview}
                        processing={
                          uploadingMediaIds.has(item.id) || processingEditIds.has(item.id)
                        }
                        onManageShare={setShareTarget}
                        trashActions={
                          view === 'trash'
                            ? {
                                onRestore: (id) => restoreOneMutation.mutate(id),
                                onDeleteForever: setDeleteForeverTarget,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-md overflow-hidden">
                    {items.map((item) => (
                      <MediaItemList
                        key={item.id}
                        item={item}
                        selected={selected.has(item.id)}
                        onToggle={handleToggle}
                        onDetail={handleDetail}
                        onPreview={handlePreview}
                        processing={
                          uploadingMediaIds.has(item.id) || processingEditIds.has(item.id)
                        }
                        onManageShare={setShareTarget}
                        trashActions={
                          view === 'trash'
                            ? {
                                onRestore: (id) => restoreOneMutation.mutate(id),
                                onDeleteForever: setDeleteForeverTarget,
                              }
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {detailItem && (
          <DetailDrawer
            item={detailItem}
            onClose={() => setDetailItem(null)}
            onDeleted={() => {
              queryClient.invalidateQueries({ queryKey: ['media'] })
              setDetailItem(null)
            }}
            onUpdated={(mediaId) => {
              setDetailItem((cur) => {
                if (cur?.id === mediaId)
                  mediaApi
                    .get(mediaId)
                    .then(setDetailItem)
                    .catch(() => {})
                return cur
              })
            }}
            onPreview={() => setLightboxItem(detailItem)}
            processing={processingEditIds.has(detailItem.id)}
            onEditJobStarted={pollEditJob}
          />
        )}
      </div>

      <MediaLightbox item={lightboxItem} onClose={() => setLightboxItem(null)} />

      {/* KDL-172: opened directly from the grid/list "Shared" badge */}
      {shareTarget && (
        <ShareDialog
          open={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          mediaId={shareTarget.id}
          mediaName={shareTarget.original_name}
        />
      )}

      {/* A8: chunked upload dialog */}
      {chunkedOpen && chunkedFiles.length > 0 && (
        <ChunkedUploadDialog
          files={chunkedFiles}
          folderId={selectedFolder ?? null}
          onComplete={() => {
            invalidateAll()
            toast({ title: 'Chunked upload complete' })
          }}
          onClose={() => {
            setChunkedOpen(false)
            setChunkedFiles([])
          }}
        />
      )}

      {/* D8: cloud import dialog */}
      {cloudImportOpen && (
        <CloudImportDialog
          folderId={selectedFolder ?? null}
          onClose={() => setCloudImportOpen(false)}
          onImported={invalidateAll}
        />
      )}

      {/* D8: capture dialog (webcam / screen / voice) */}
      {captureOpen && (
        <CaptureDialog
          folderId={selectedFolder ?? null}
          onClose={() => setCaptureOpen(false)}
          onUploaded={invalidateAll}
        />
      )}

      {/* Create folder */}
      <Modal
        open={createFolderOpen}
        onClose={() => {
          setCreateFolderOpen(false)
          setNewFolderName('')
        }}
        title="New folder"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createFolderMutation.mutate()}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <Input
          placeholder="Folder name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && newFolderName.trim() && createFolderMutation.mutate()
          }
          autoFocus
        />
      </Modal>

      {/* Rename folder */}
      <Modal
        open={renameFolderTarget !== null}
        onClose={() => setRenameFolderTarget(null)}
        title="Rename folder"
        footer={
          <>
            <Button variant="outline" onClick={() => setRenameFolderTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => renameFolderMutation.mutate()}
              disabled={!renameFolderName.trim() || renameFolderMutation.isPending}
            >
              Save
            </Button>
          </>
        }
      >
        <Input
          value={renameFolderName}
          onChange={(e) => setRenameFolderName(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && renameFolderName.trim() && renameFolderMutation.mutate()
          }
          autoFocus
        />
      </Modal>

      {/* Delete folder */}
      <ConfirmDialog
        open={deleteFolderTarget !== null}
        onClose={() => setDeleteFolderTarget(null)}
        onConfirm={() => deleteFolderMutation.mutate(false)}
        title="Delete folder?"
        description={`Delete "${deleteFolderTarget?.name}"? If not empty, the deletion will fail unless cascade is used.`}
        isLoading={deleteFolderMutation.isPending}
      />

      {/* Move files */}
      <Modal
        open={moveOpen}
        onClose={() => setMoveOpen(false)}
        title="Move files"
        footer={
          <>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => moveMutation.mutate()} disabled={moveMutation.isPending}>
              Move here
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Choose destination:</p>
          <button
            type="button"
            onClick={() => setMoveTargetFolder(null)}
            className={cn(
              'w-full text-left px-3 py-2 rounded border text-sm',
              moveTargetFolder === null && 'border-primary bg-primary/5'
            )}
          >
            Root (no folder)
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setMoveTargetFolder(f.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded border text-sm flex items-center gap-2',
                moveTargetFolder === f.id && 'border-primary bg-primary/5'
              )}
            >
              <Folder className="h-3.5 w-3.5 text-amber-500" />
              {f.name}
            </button>
          ))}
        </div>
      </Modal>

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={() => bulkDeleteMutation.mutate()}
        title={`Delete ${selected.size} file(s)?`}
        description="Files in use cannot be deleted. Others will be moved to trash."
        isLoading={bulkDeleteMutation.isPending}
      />

      {/* Purge confirm */}
      <ConfirmDialog
        open={confirmPurge}
        onClose={() => setConfirmPurge(false)}
        onConfirm={() => purgeMutation.mutate()}
        title={`Permanently delete ${trashCount} file(s)?`}
        description="This permanently removes all files from storage. Cannot be undone."
        isLoading={purgeMutation.isPending}
        variant="destructive"
      />

      {/* Single-file permanent delete confirm */}
      <ConfirmDialog
        open={deleteForeverTarget !== null}
        onClose={() => setDeleteForeverTarget(null)}
        onConfirm={() => deleteForeverTarget && deleteForeverMutation.mutate(deleteForeverTarget)}
        title="Permanently delete this file?"
        description="This removes the file from storage. Cannot be undone."
        isLoading={deleteForeverMutation.isPending}
        variant="destructive"
      />
    </PermissionGuard>
  )
}
