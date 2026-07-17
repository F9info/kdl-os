'use client'

// KDL-119 A8 — DAM frontend extensions: search facets, tag manager, custom-field
// editor, collections/favorites/recents views, chunked upload with progress + resume,
// drag-drop folder upload, clipboard paste upload.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Plus,
  Star,
  Clock,
  Layers,
  Upload,
  Folder as FolderIcon,
  Search,
  Sparkles,
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AppImage } from '@/components/shared/AppImage'
import type {
  Media,
  MediaTag,
  MediaMetaField,
  MediaCollection,
  MediaSearchResult,
  MediaSearchDoc,
  ChunkedUploadStatus,
} from '@/types/media.types'

// ─── API helpers ──────────────────────────────────────────────────────────────

const damApi = {
  // A3 faceted search — returns { hits, facets, pagination }
  // D5: mode=semantic routes through the ChromaDB embeddings ∩ Meili hybrid search
  search: (q: string, filters: Record<string, string>) =>
    api
      .get('/media/search', { params: { q, ...filters } })
      .then((r) => r.data.data as MediaSearchResult),

  // A2 tags — media rows carry tag NAMES; tag/untag are bulk by name
  listTags: () => api.get('/media/tags').then((r) => r.data.data.tags as MediaTag[]),
  createTag: (name: string) => api.post('/media/tags', { name }),
  deleteTag: (id: string) => api.delete(`/media/tags/${id}`),
  tagMedia: (mediaIds: string[], tags: string[]) =>
    api.post('/media/tag', { media_ids: mediaIds, tags }),
  untagMedia: (mediaIds: string[], tags: string[]) =>
    api.post('/media/untag', { media_ids: mediaIds, tags }),

  // A2 custom meta fields — media PATCH takes meta {slug: value|null}
  listMetaFields: () =>
    api.get('/media/meta-fields').then((r) => r.data.data.fields as MediaMetaField[]),
  setMeta: (mediaId: string, meta: Record<string, string | null>) =>
    api.patch(`/media/${mediaId}`, { meta }),

  // A4 collections
  listCollections: () =>
    api.get('/media/collections').then((r) => r.data.data.collections as MediaCollection[]),
  createCollection: (data: { name: string; is_smart?: boolean; rules?: Record<string, unknown> }) =>
    api.post('/media/collections', data),
  addToCollection: (collectionId: string, mediaIds: string[]) =>
    api.post(`/media/collections/${collectionId}/items`, { media_ids: mediaIds }),
  removeFromCollection: (collectionId: string, mediaIds: string[]) =>
    api.delete(`/media/collections/${collectionId}/items`, { data: { media_ids: mediaIds } }),
  // static collections → hits are full Media rows; smart → Meili docs
  collectionItems: (id: string) =>
    api
      .get(`/media/collections/${id}`)
      .then(
        (r) => r.data.data as { collection: MediaCollection; hits: (Media | MediaSearchDoc)[] }
      ),

  // A4 favorites
  listFavorites: () => api.get('/media/favorites').then((r) => r.data.data.media as Media[]),
  addFavorite: (mediaId: string) => api.post(`/media/${mediaId}/favorite`),
  removeFavorite: (mediaId: string) => api.delete(`/media/${mediaId}/favorite`),

  // A4 recents
  listRecents: () => api.get('/media/recent').then((r) => r.data.data.media as Media[]),

  // A5 chunked upload
  chunkInit: (data: {
    filename: string
    size: number
    mime_type: string
    folder_id?: string | null
    total_parts: number
  }) =>
    api
      .post('/media/upload/chunked/init', data)
      .then((r) => r.data.data as { upload_id: string; total_parts: number }),
  chunkPart: (uploadId: string, index: number, chunk: Blob) => {
    const fd = new FormData()
    fd.append('chunk', chunk)
    return api.put(`/media/upload/chunked/${uploadId}/part`, fd, {
      params: { index: String(index) },
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  chunkComplete: (uploadId: string) =>
    api.post(`/media/upload/chunked/${uploadId}/complete`).then((r) => r.data.data.media as Media),
  chunkStatus: (uploadId: string) =>
    api
      .get(`/media/upload/chunked/${uploadId}/status`)
      .then((r) => r.data.data as ChunkedUploadStatus),
}

export { damApi }

// ─── Faceted search bar ───────────────────────────────────────────────────────

interface SearchFacetsProps {
  onResults: (results: MediaSearchResult | null) => void
  onClear: () => void
  // D5: only show the semantic toggle once an embeddings AI provider is configured
  // (mirrors the aiStatus-gated Analyze/Transcribe controls elsewhere on this page).
  semanticEnabled?: boolean
}

export function SearchFacets({ onResults, onClear, semanticEnabled }: SearchFacetsProps) {
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [semantic, setSemantic] = useState(false)
  const [active, setActive] = useState(false)

  const { data: tags } = useQuery({ queryKey: ['media-tags'], queryFn: damApi.listTags })

  const searchQuery = useQuery({
    queryKey: ['media-search', q, tagFilter, typeFilter, semantic],
    queryFn: () => {
      const filters: Record<string, string> = {}
      if (tagFilter) filters.tags = tagFilter
      if (typeFilter) filters.type = typeFilter
      if (semantic && semanticEnabled) filters.mode = 'semantic'
      return damApi.search(q, filters)
    },
    enabled: active && (q.length > 0 || Boolean(tagFilter) || Boolean(typeFilter)),
  })

  useEffect(() => {
    if (!active) return
    if (searchQuery.data) onResults(searchQuery.data)
    if (!q && !tagFilter && !typeFilter) {
      onClear()
      setActive(false)
    }
  }, [searchQuery.data, q, tagFilter, typeFilter, active, onResults, onClear])

  // Typing in the box previously did nothing until Enter was pressed, unlike
  // the type/tag <select>s which activate immediately on change — debounce
  // the text input so it behaves the same way.
  useEffect(() => {
    if (!q) return
    const t = setTimeout(() => setActive(true), 300)
    return () => clearTimeout(t)
  }, [q])

  const handleSearch = () => {
    if (!q && !tagFilter && !typeFilter) {
      onClear()
      setActive(false)
      return
    }
    setActive(true)
  }

  const handleClear = () => {
    setQ('')
    setTagFilter('')
    setTypeFilter('')
    setSemantic(false)
    setActive(false)
    onClear()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[160px]">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search media…"
          value={q}
          className="pl-8 h-9"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
      </div>
      {semanticEnabled && (
        <button
          type="button"
          onClick={() => {
            setSemantic((s) => !s)
            setActive(true)
          }}
          title="Natural-language (semantic) search"
          aria-pressed={semantic}
          className={cn(
            'flex items-center gap-1 h-9 px-2 rounded border text-sm',
            semantic
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background hover:bg-accent'
          )}
        >
          <Sparkles className="h-4 w-4" />
          Semantic
        </button>
      )}
      <select
        value={typeFilter}
        onChange={(e) => {
          setTypeFilter(e.target.value)
          setActive(true)
        }}
        className="border rounded h-9 text-sm px-2 bg-background"
      >
        <option value="">All types</option>
        {['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER'].map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <select
        value={tagFilter}
        onChange={(e) => {
          setTagFilter(e.target.value)
          setActive(true)
        }}
        className="border rounded h-9 text-sm px-2 bg-background"
      >
        <option value="">All tags</option>
        {(tags ?? []).map((t) => (
          <option key={t.id} value={t.name}>
            {t.name}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={handleClear}
          className="p-1 rounded hover:bg-accent"
          title="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {searchQuery.data && (
        <span className="text-xs text-muted-foreground">
          {searchQuery.data.pagination.total} result
          {searchQuery.data.pagination.total !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ─── Tag chips on a media item ────────────────────────────────────────────────

export function MediaTagChips({
  mediaId,
  tags,
  onChange,
}: {
  mediaId: string
  tags: string[]
  onChange: () => void
}) {
  const queryClient = useQueryClient()
  const { data: allTags } = useQuery({ queryKey: ['media-tags'], queryFn: damApi.listTags })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['media-tags'] })
    onChange()
  }
  const addMut = useMutation({
    mutationFn: (tag: string) => damApi.tagMedia([mediaId], [tag]),
    onSuccess: invalidate,
    onError: () => toast({ title: 'Tag failed', variant: 'destructive' }),
  })
  const removeMut = useMutation({
    mutationFn: (tag: string) => damApi.untagMedia([mediaId], [tag]),
    onSuccess: invalidate,
    onError: () => toast({ title: 'Remove tag failed', variant: 'destructive' }),
  })

  const [addOpen, setAddOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const available = (allTags ?? []).map((t) => t.name).filter((n) => !tags.includes(n))

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tags.map((t) => (
          <Badge
            key={t}
            className="text-xs cursor-pointer border"
            onClick={() => removeMut.mutate(t)}
            title="Click to remove"
          >
            {t} <X className="h-2.5 w-2.5 ml-1" />
          </Badge>
        ))}
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Add tag
        </button>
      </div>
      {addOpen && (
        <div className="space-y-1 border rounded p-2 bg-muted/30">
          {available.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {available.map((t) => (
                <Badge
                  key={t}
                  variant="outline"
                  className="cursor-pointer text-xs"
                  onClick={() => {
                    addMut.mutate(t)
                    setAddOpen(false)
                  }}
                >
                  {t}
                </Badge>
              ))}
            </div>
          )}
          <div className="flex gap-1">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="New tag"
              className="h-7 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTag.trim()) {
                  addMut.mutate(newTag.trim())
                  setNewTag('')
                  setAddOpen(false)
                }
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tag manager (admin: create / delete tags) ────────────────────────────────

export function TagManager() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const { data: tags } = useQuery({ queryKey: ['media-tags'], queryFn: damApi.listTags })

  const createMut = useMutation({
    mutationFn: () => damApi.createTag(name.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-tags'] })
      setName('')
    },
    onError: () => toast({ title: 'Create tag failed', variant: 'destructive' }),
  })
  const deleteMut = useMutation({
    mutationFn: (id: string) => damApi.deleteTag(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media-tags'] }),
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  })

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Tags</p>
      <div className="flex gap-2 flex-wrap">
        {(tags ?? []).map((t) => (
          <Badge
            key={t.id}
            className="border cursor-pointer text-xs"
            onClick={() => deleteMut.mutate(t.id)}
            title="Click to delete"
          >
            {t.name}
            {t._count ? <span className="ml-1 text-muted-foreground">{t._count.media}</span> : null}
            <X className="h-2.5 w-2.5 ml-1" />
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tag name"
          className="h-8 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMut.mutate()}
        />
        <Button
          size="sm"
          onClick={() => createMut.mutate()}
          disabled={!name.trim() || createMut.isPending}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

// ─── Custom-field editor (in detail drawer) ───────────────────────────────────

export function CustomFieldEditor({
  mediaId,
  meta,
  onChange,
}: {
  mediaId: string
  meta: Record<string, string>
  onChange: () => void
}) {
  const { data: fields } = useQuery({
    queryKey: ['media-meta-fields'],
    queryFn: damApi.listMetaFields,
  })
  const [draft, setDraft] = useState<Record<string, string>>({})

  // seed draft from existing values (keyed by slug, matching the API shape)
  useEffect(() => {
    setDraft({ ...meta })
  }, [meta])

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {}
      ;(fields ?? []).forEach((f) => {
        const val = draft[f.slug] ?? ''
        const prev = meta[f.slug] ?? ''
        if (val !== prev) payload[f.slug] = val === '' ? null : val
      })
      return damApi.setMeta(mediaId, payload)
    },
    onSuccess: () => {
      toast({ title: 'Saved' })
      onChange()
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  })

  if (!fields || fields.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Custom fields
      </p>
      {fields.map((f) => (
        <div key={f.id} className="space-y-0.5">
          <label className="text-xs text-muted-foreground">{f.label}</label>
          {f.field_type === 'SELECT' ? (
            <select
              value={draft[f.slug] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.slug]: e.target.value }))}
              className="border rounded h-8 text-xs px-2 w-full bg-background"
            >
              <option value="">—</option>
              {(f.options ?? []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={draft[f.slug] ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, [f.slug]: e.target.value }))}
              placeholder={f.field_type === 'DATE' ? 'YYYY-MM-DD' : f.label}
              type={
                f.field_type === 'NUMBER' ? 'number' : f.field_type === 'DATE' ? 'date' : 'text'
              }
              className="h-8 text-xs"
            />
          )}
        </div>
      ))}
      <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
        Save fields
      </Button>
    </div>
  )
}

// ─── Sidebar view types ───────────────────────────────────────────────────────

export type SidebarView = 'folders' | 'collections' | 'favorites' | 'recents'

interface SidebarNavProps {
  current: SidebarView
  onChange: (v: SidebarView) => void
  // KDL-MEDIA-12: tabs not in this list are hidden (collections/favorites are
  // distinct granted features); omit to show all.
  visible?: SidebarView[]
}

export function SidebarNav({ current, onChange, visible }: SidebarNavProps) {
  const allTabs: { id: SidebarView; label: string; icon: React.ReactNode }[] = [
    { id: 'folders', label: 'Folders', icon: <FolderIcon className="h-3.5 w-3.5" /> },
    { id: 'collections', label: 'Collections', icon: <Layers className="h-3.5 w-3.5" /> },
    { id: 'favorites', label: 'Favorites', icon: <Star className="h-3.5 w-3.5" /> },
    { id: 'recents', label: 'Recents', icon: <Clock className="h-3.5 w-3.5" /> },
  ]
  const tabs = visible ? allTabs.filter((t) => visible.includes(t.id)) : allTabs
  return (
    <div className="flex border-b bg-muted/30">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'flex-1 flex flex-col items-center py-1.5 gap-0.5 text-[10px] transition-colors',
            current === t.id
              ? 'bg-background text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={t.label}
        >
          {t.icon}
          <span className="hidden sm:block">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Collections sidebar panel ────────────────────────────────────────────────

interface CollectionsPanelProps {
  onSelect: (collectionId: string | null) => void
  selected: string | null
}

export function CollectionsPanel({ onSelect, selected }: CollectionsPanelProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)

  const { data: collections } = useQuery({
    queryKey: ['media-collections'],
    queryFn: damApi.listCollections,
  })

  const createMut = useMutation({
    mutationFn: () => damApi.createCollection({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-collections'] })
      setName('')
      setCreating(false)
    },
    onError: () => toast({ title: 'Create failed', variant: 'destructive' }),
  })

  return (
    <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
      {(collections ?? []).map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onSelect(c.id)}
          className={cn(
            'flex items-center gap-2 rounded px-2 py-1 text-sm w-full hover:bg-accent text-left',
            selected === c.id && 'bg-accent font-medium'
          )}
        >
          <Layers className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{c.name}</span>
          {c.is_smart && (
            <Badge variant="outline" className="ml-auto text-[10px] px-1">
              Smart
            </Badge>
          )}
          {c._count && <span className="text-muted-foreground text-xs ml-1">{c._count.items}</span>}
        </button>
      ))}
      {creating ? (
        <div className="flex gap-1 p-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collection name"
            className="h-7 text-xs"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && name.trim() && createMut.mutate()}
          />
          <Button
            size="sm"
            className="h-7 px-2"
            onClick={() => createMut.mutate()}
            disabled={!name.trim() || createMut.isPending}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <button type="button" onClick={() => setCreating(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 w-full"
        >
          <Plus className="h-3 w-3" /> New collection
        </button>
      )}
    </div>
  )
}

// ─── Collection items view ────────────────────────────────────────────────────

export function CollectionItemsView({
  collectionId,
  onDetail,
}: {
  collectionId: string
  onDetail: (mediaId: string) => void
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['media-collection-items', collectionId],
    queryFn: () => damApi.collectionItems(collectionId),
  })

  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  if (!data?.hits?.length)
    return <p className="p-4 text-sm text-muted-foreground">No items in this collection.</p>

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
      {data.hits.map((item) => (
        <MediaThumbnailCard key={item.id} item={item} onDetail={onDetail} />
      ))}
    </div>
  )
}

// ─── Favorites view ───────────────────────────────────────────────────────────

export function FavoritesView({ onDetail }: { onDetail: (mediaId: string) => void }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ['media-favorites'],
    queryFn: damApi.listFavorites,
  })
  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  if (!items?.length) return <p className="p-4 text-sm text-muted-foreground">No favorites yet.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
      {items.map((item) => (
        <MediaThumbnailCard key={item.id} item={item} onDetail={onDetail} />
      ))}
    </div>
  )
}

// ─── Recents view ─────────────────────────────────────────────────────────────

export function RecentsView({ onDetail }: { onDetail: (mediaId: string) => void }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ['media-recents'],
    queryFn: damApi.listRecents,
  })
  if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading…</p>
  if (!items?.length) return <p className="p-4 text-sm text-muted-foreground">No recent files.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 p-3">
      {items.map((item) => (
        <MediaThumbnailCard key={item.id} item={item} onDetail={onDetail} />
      ))}
    </div>
  )
}

// ─── Small thumbnail card (shared) ───────────────────────────────────────────
// Tolerates both full Media rows and flat Meili docs (no url/variants).

function MediaThumbnailCard({
  item,
  onDetail,
}: {
  item: Media | MediaSearchDoc
  onDetail: (mediaId: string) => void
}) {
  const asMedia = item as Partial<Media>
  const name = asMedia.original_name ?? (item as MediaSearchDoc).name ?? 'file'
  const thumb =
    asMedia.variants?.thumb ??
    asMedia.variants?.small ??
    (item.mime_type?.startsWith('image/') ? (asMedia.url ?? null) : null)
  return (
    <button
      type="button"
      onClick={() => onDetail(item.id)}
      className="group relative aspect-square rounded border overflow-hidden bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary"
      title={name}
    >
      {thumb ? (
        <AppImage size="thumbnail" src={thumb} alt={name} className="max-w-full max-h-full" />
      ) : (
        <span className="text-xs text-muted-foreground">{item.type?.[0] ?? '?'}</span>
      )}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
        {name}
      </div>
    </button>
  )
}

// ─── Chunked upload dialog with progress + resume ─────────────────────────────

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB per chunk

interface ChunkUploadState {
  file: File
  uploadId: string
  totalChunks: number
  sent: number
  done: boolean
  error: string | null
}

interface ChunkedUploadDialogProps {
  files: File[]
  folderId?: string | null
  onComplete: () => void
  onClose: () => void
}

export function ChunkedUploadDialog({
  files,
  folderId,
  onComplete,
  onClose,
}: ChunkedUploadDialogProps) {
  const [states, setStates] = useState<ChunkUploadState[]>([])
  const [started, setStarted] = useState(false)
  const abortRef = useRef(false)

  const updateState = (idx: number, patch: Partial<ChunkUploadState>) =>
    setStates((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))

  const startUpload = useCallback(async () => {
    if (started) return
    setStarted(true)
    abortRef.current = false

    setStates(
      files.map((f) => ({
        file: f,
        uploadId: '',
        totalChunks: Math.ceil(f.size / CHUNK_SIZE),
        sent: 0,
        done: false,
        error: null,
      }))
    )

    let allSucceeded = true
    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) {
        allSucceeded = false
        break
      }
      const f = files[i]!
      try {
        const totalParts = Math.max(1, Math.ceil(f.size / CHUNK_SIZE))
        const { upload_id } = await damApi.chunkInit({
          filename: f.name,
          size: f.size,
          mime_type: f.type || 'application/octet-stream',
          folder_id: folderId,
          total_parts: totalParts,
        })
        updateState(i, { uploadId: upload_id })

        // Resume: skip parts the server already has
        let received = new Set<number>()
        try {
          const status = await damApi.chunkStatus(upload_id)
          received = new Set(status.received_parts)
          updateState(i, { sent: received.size })
        } catch {
          /* fresh session — nothing received yet */
        }

        let sent = received.size
        for (let p = 0; p < totalParts; p++) {
          if (abortRef.current) break
          if (received.has(p)) continue
          const start = p * CHUNK_SIZE
          const chunk = f.slice(start, start + CHUNK_SIZE)
          await damApi.chunkPart(upload_id, p, chunk)
          sent += 1
          updateState(i, { sent })
        }

        if (!abortRef.current) {
          await damApi.chunkComplete(upload_id)
          updateState(i, { done: true })
        } else {
          allSucceeded = false
        }
      } catch (err: unknown) {
        allSucceeded = false
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          'Upload failed'
        updateState(i, { error: msg })
      }
    }

    if (!abortRef.current && allSucceeded) onComplete()
  }, [files, folderId, started, onComplete])

  // auto-start
  useEffect(() => {
    startUpload()
  }, [startUpload])

  const allDone = states.length > 0 && states.every((s) => s.done || s.error)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog">
      <div className="bg-background rounded-lg shadow-xl p-6 w-[480px] max-h-[80vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" /> Uploading {files.length} file
            {files.length !== 1 ? 's' : ''}
          </h3>
          {allDone && (
            <button type="button" onClick={onClose}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="space-y-3">
          {states.map((s, i) => {
            const pct = s.totalChunks > 0 ? Math.round((s.sent / s.totalChunks) * 100) : 0
            return (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate max-w-[300px]">{s.file.name}</span>
                  <span className="text-muted-foreground ml-2 flex-shrink-0">
                    {s.done ? '✓' : s.error ? '✗' : `${pct}%`}
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      s.error ? 'bg-destructive' : s.done ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${s.done ? 100 : pct}%` }}
                  />
                </div>
                {s.error && <p className="text-xs text-destructive">{s.error}</p>}
              </div>
            )
          })}
        </div>
        {allDone && (
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                onComplete()
                onClose()
              }}
            >
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Folder upload (webkitdirectory) ─────────────────────────────────────────

interface FolderUploadButtonProps {
  onFiles: (files: File[], relativePaths: string[]) => void
  disabled?: boolean
}

export function FolderUploadButton({ onFiles, disabled }: FolderUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const paths = files.map(
      (f) => (f as File & { webkitRelativePath?: string }).webkitRelativePath ?? f.name
    )
    if (files.length) onFiles(files, paths)
    e.target.value = '' // reset so same folder can be re-selected
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex items-center gap-1 px-3 h-9 text-sm rounded border hover:bg-accent transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        title="Upload folder"
      >
        <FolderIcon className="h-4 w-4" /> Upload Folder
      </button>
      <input
        ref={inputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory is non-standard but widely supported
        webkitdirectory="true"
        multiple
        className="hidden"
        onChange={handleChange}
      />
    </>
  )
}

// ─── Clipboard paste upload hook ──────────────────────────────────────────────

export function useClipboardPaste(onFiles: (files: File[]) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return
    const handler = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? [])
      const files = items
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f): f is File => f !== null)
      if (files.length) {
        e.preventDefault()
        onFiles(files)
      }
    }
    document.addEventListener('paste', handler)
    return () => document.removeEventListener('paste', handler)
  }, [onFiles, enabled])
}

// ─── Favorite toggle button ───────────────────────────────────────────────────

export function FavoriteButton({
  mediaId,
  isFav,
  onChange,
}: {
  mediaId: string
  isFav: boolean
  onChange: () => void
}) {
  const addMut = useMutation({
    mutationFn: () => (isFav ? damApi.removeFavorite(mediaId) : damApi.addFavorite(mediaId)),
    onSuccess: onChange,
    onError: () => toast({ title: 'Failed', variant: 'destructive' }),
  })
  return (
    <button
      type="button"
      onClick={() => addMut.mutate()}
      title={isFav ? 'Remove from favorites' : 'Add to favorites'}
      className={cn('p-1 rounded hover:bg-accent', isFav && 'text-yellow-500')}
    >
      <Star className={cn('h-4 w-4', isFav && 'fill-current')} />
    </button>
  )
}
