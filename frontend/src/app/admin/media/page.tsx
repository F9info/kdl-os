'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Folder, FolderPlus, ChevronRight, Upload, Grid, List, Search, Trash2,
  Move, RefreshCcw, AlertTriangle, X, Eye, Pencil, Info
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { useDebounce } from '@/hooks/useDebounce'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Media, MediaFolder, MediaType, MediaUsage } from '@/types/media.types'

// ── API helpers ──────────────────────────────────────────────────────────────

const mediaApi = {
  list: (params: Record<string, string>) => api.get('/media', { params }).then((r) => r.data.data),
  folders: () => api.get('/media/folders').then((r) => r.data.data.folders as MediaFolder[]),
  trash: () => api.get('/media/trash').then((r) => r.data.data.media as Media[]),
  usage: (id: string) => api.get(`/media/${id}/usage`).then((r) => r.data.data.usages as MediaUsage[]),
  createFolder: (data: { name: string; parent_id?: string | null }) => api.post('/media/folders', data),
  renameFolder: (id: string, data: { name?: string; parent_id?: string | null }) =>
    api.patch(`/media/folders/${id}`, data),
  deleteFolder: (id: string, cascade = false) =>
    api.delete(`/media/folders/${id}${cascade ? '?cascade=true' : ''}`),
  upload: (files: File[], folderId?: string | null) => {
    const fd = new FormData()
    files.forEach((f) => fd.append('files', f))
    if (folderId) fd.append('folder_id', folderId)
    return api.post('/media/upload', fd)
  },
  update: (id: string, data: Partial<Pick<Media, 'title' | 'alt_text' | 'caption' | 'original_name'>>) =>
    api.patch(`/media/${id}`, data),
  delete: (id: string) => api.delete(`/media/${id}`),
  bulkDelete: (media_ids: string[]) => api.post('/media/bulk-delete', { media_ids }),
  move: (media_ids: string[], folder_id: string | null) =>
    api.post('/media/move', { media_ids, folder_id }),
  restoreTrash: (media_ids: string[]) => api.post('/media/trash/restore', { media_ids }),
  purgeTrash: () => api.delete('/media/trash/purge'),
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
          onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
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
            <span className="text-xs text-muted-foreground ml-auto pr-1">{folder._count.media}</span>
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

function MediaItemGrid({
  item,
  selected,
  onToggle,
  onDetail,
}: {
  item: Media
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onDetail: (item: Media) => void
}) {
  const thumb = item.variants?.thumb ?? (item.mime_type.startsWith('image/') ? item.url : null)
  return (
    <div
      className={cn(
        'relative border rounded-lg overflow-hidden cursor-pointer hover:border-primary transition-all',
        selected && 'border-primary ring-2 ring-primary/30'
      )}
      onClick={(e) => onToggle(item.id, e)}
    >
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={item.original_name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-2xl text-muted-foreground font-bold">{item.type[0]}</span>
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
          onClick={(e) => { e.stopPropagation(); onToggle(item.id, e as unknown as React.MouseEvent) }}
        />
      </div>
      <button
        type="button"
        className="absolute top-1 right-1 p-0.5 bg-background/80 rounded hover:bg-background"
        onClick={(e) => { e.stopPropagation(); onDetail(item) }}
      >
        <Eye className="h-3 w-3" />
      </button>
    </div>
  )
}

function MediaItemList({
  item,
  selected,
  onToggle,
  onDetail,
}: {
  item: Media
  selected: boolean
  onToggle: (id: string, e: React.MouseEvent) => void
  onDetail: (item: Media) => void
}) {
  const thumb = item.variants?.thumb ?? (item.mime_type.startsWith('image/') ? item.url : null)
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 border-b hover:bg-accent/40 cursor-pointer',
        selected && 'bg-accent'
      )}
      onClick={(e) => onToggle(item.id, e)}
    >
      <input
        type="checkbox"
        checked={selected}
        readOnly
        className="h-4 w-4 rounded"
        onClick={(e) => { e.stopPropagation(); onToggle(item.id, e as unknown as React.MouseEvent) }}
      />
      <div className="h-8 w-8 flex-shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={item.original_name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-xs text-muted-foreground">{item.type[0]}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate font-medium">{item.title || item.original_name}</p>
        <p className="text-xs text-muted-foreground">{item.mime_type} · {formatBytes(item.size)}</p>
      </div>
      <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDetail(item) }}
        className="p-1 hover:text-foreground text-muted-foreground"
      >
        <Info className="h-4 w-4" />
      </button>
    </div>
  )
}

// ── Upload zone ───────────────────────────────────────────────────────────────

function UploadZone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  return (
    <div
      className={cn(
        'border-2 border-dashed rounded-lg px-4 py-2 text-center transition-colors cursor-pointer flex items-center gap-2',
        drag ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
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

// ── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({
  item,
  onClose,
  onDeleted,
}: {
  item: Media
  onClose: () => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(item.title ?? '')
  const [altText, setAltText] = useState(item.alt_text ?? '')
  const [caption, setCaption] = useState(item.caption ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const { data: usages } = useQuery({
    queryKey: ['media-usage', item.id],
    queryFn: () => mediaApi.usage(item.id),
  })

  const updateMutation = useMutation({
    mutationFn: () => mediaApi.update(item.id, { title, alt_text: altText, caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({ title: 'Saved' })
    },
    onError: () => toast({ title: 'Save failed', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => mediaApi.delete(item.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      onDeleted()
      onClose()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Delete failed'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-30 overflow-y-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold">File Details</h3>
        <button type="button" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      {item.mime_type.startsWith('image/') && item.url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.url} alt={item.original_name} className="w-full rounded border" />
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Metadata</p>
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

      <div className="space-y-1 text-xs text-muted-foreground">
        <p>File: <span className="text-foreground">{item.original_name}</span></p>
        <p>Size: <span className="text-foreground">{formatBytes(item.size)}</span></p>
        <p>Type: <span className="text-foreground">{item.mime_type}</span></p>
        {item.width && item.height && (
          <p>Dimensions: <span className="text-foreground">{item.width}×{item.height}px</span></p>
        )}
        <p>Uploaded: <span className="text-foreground">{formatDate(item.created_at)}</span></p>
      </div>

      {item.variants && Object.values(item.variants).some(Boolean) && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Variants</p>
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

      {usages && usages.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Used by</p>
          {usages.map((u) => (
            <Badge key={u.id} variant="secondary" className="text-xs mr-1">
              {u.entity}
            </Badge>
          ))}
        </div>
      )}

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
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = 'files' | 'trash'

export default function MediaPage() {
  const { can } = usePermissions()
  const queryClient = useQueryClient()

  const [view, setView] = useState<ViewMode>('files')
  const [gridMode, setGridMode] = useState<'grid' | 'list'>('grid')
  const [selectedFolder, setSelectedFolder] = useState<string | null | undefined>(undefined)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<MediaType | ''>('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detailItem, setDetailItem] = useState<Media | null>(null)
  const [lastClickIdx, setLastClickIdx] = useState<number | null>(null)

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

  const foldersQuery = useQuery({ queryKey: ['media-folders'], queryFn: mediaApi.folders })
  const folders = foldersQuery.data ?? []

  const mediaParams: Record<string, string> = { limit: '50' }
  if (selectedFolder !== undefined) mediaParams.folder_id = selectedFolder === null ? 'null' : selectedFolder
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

  const items: Media[] = view === 'files'
    ? (mediaQuery.data?.media ?? [])
    : (trashQuery.data ?? [])

  // ── Mutations ────────────────────────────────────────────────────────────────

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['media'] })
    queryClient.invalidateQueries({ queryKey: ['media-folders'] })
    queryClient.invalidateQueries({ queryKey: ['media-trash'] })
  }

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => mediaApi.upload(files, selectedFolder ?? null),
    onSuccess: () => { invalidateAll(); toast({ title: 'Upload complete' }) },
    onError: () => toast({ title: 'Upload failed', variant: 'destructive' }),
  })

  const createFolderMutation = useMutation({
    mutationFn: () => mediaApi.createFolder({ name: newFolderName, parent_id: selectedFolder ?? null }),
    onSuccess: () => { invalidateAll(); setCreateFolderOpen(false); setNewFolderName('') },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const renameFolderMutation = useMutation({
    mutationFn: () => mediaApi.renameFolder(renameFolderTarget!.id, { name: renameFolderName }),
    onSuccess: () => { invalidateAll(); setRenameFolderTarget(null) },
    onError: () => toast({ title: 'Rename failed', variant: 'destructive' }),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (cascade: boolean) => mediaApi.deleteFolder(deleteFolderTarget!.id, cascade),
    onSuccess: () => { invalidateAll(); setDeleteFolderTarget(null) },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: () => mediaApi.bulkDelete(Array.from(selected)),
    onSuccess: () => { invalidateAll(); setSelected(new Set()); setConfirmBulkDelete(false) },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Some files are in use'
      toast({ title: msg, variant: 'destructive' })
      setConfirmBulkDelete(false)
    },
  })

  const moveMutation = useMutation({
    mutationFn: () => mediaApi.move(Array.from(selected), moveTargetFolder),
    onSuccess: () => { invalidateAll(); setSelected(new Set()); setMoveOpen(false) },
    onError: () => toast({ title: 'Move failed', variant: 'destructive' }),
  })

  const restoreMutation = useMutation({
    mutationFn: () => mediaApi.restoreTrash(Array.from(selected)),
    onSuccess: () => { invalidateAll(); setSelected(new Set()) },
    onError: () => toast({ title: 'Restore failed', variant: 'destructive' }),
  })

  const purgeMutation = useMutation({
    mutationFn: mediaApi.purgeTrash,
    onSuccess: () => { invalidateAll(); setConfirmPurge(false); toast({ title: 'Trash purged' }) },
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
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 border-r flex flex-col bg-background">
          <div className="p-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Folders</span>
            {can('media:add') && (
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
              onClick={() => { setView('files'); setSelectedFolder(undefined) }}
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
                onSelect={(id) => { setSelectedFolder(id); setView('files') }}
                folders={folders}
                onRename={(folder) => { setRenameFolderTarget(folder); setRenameFolderName(folder.name) }}
                onDelete={setDeleteFolderTarget}
              />
            ))}
          </div>
          <div className="border-t p-1">
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1 text-sm w-full hover:bg-accent',
                view === 'trash' && 'bg-accent font-medium'
              )}
              onClick={() => { setView('trash'); setSelected(new Set()) }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash
              {trashCount > 0 && (
                <Badge variant="secondary" className="ml-auto text-xs px-1">{trashCount}</Badge>
              )}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="p-3 border-b flex items-center gap-2 flex-wrap bg-background">
            {view === 'files' && (
              <>
                {can('media:add') && (
                  <UploadZone
                    onFiles={(files) => uploadMutation.mutate(files)}
                    disabled={uploadMutation.isPending}
                  />
                )}
                <div className="relative flex-1 min-w-[160px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as MediaType | '')}
                  className="border rounded h-9 text-sm px-2 bg-background"
                >
                  <option value="">All types</option>
                  {(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'OTHER'] as MediaType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </>
            )}

            {selected.size > 0 && (
              <div className="flex items-center gap-2 ml-2">
                <span className="text-sm text-muted-foreground">{selected.size} selected</span>
                {view === 'files' ? (
                  <>
                    {can('media:edit') && (
                      <Button size="sm" variant="outline" onClick={() => setMoveOpen(true)}>
                        <Move className="h-3.5 w-3.5 mr-1" />Move
                      </Button>
                    )}
                    {can('media:delete') && (
                      <Button size="sm" variant="destructive" onClick={() => setConfirmBulkDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                      </Button>
                    )}
                  </>
                ) : (
                  can('media:delete') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => restoreMutation.mutate()}
                      disabled={restoreMutation.isPending}
                    >
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" />Restore
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
              {view === 'trash' && can('media:delete') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setConfirmPurge(true)}
                  disabled={trashCount === 0}
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />Purge all
                </Button>
              )}
              <button
                type="button"
                onClick={() => setGridMode('grid')}
                className={cn('p-1.5 rounded', gridMode === 'grid' ? 'bg-accent' : 'hover:bg-accent')}
              >
                <Grid className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setGridMode('list')}
                className={cn('p-1.5 rounded', gridMode === 'list' ? 'bg-accent' : 'hover:bg-accent')}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Files area */}
          <div className="flex-1 overflow-y-auto p-3">
            {(mediaQuery.isLoading || trashQuery.isLoading) && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {(mediaQuery.error || trashQuery.error) && (
              <ErrorAlert error={mediaQuery.error ?? trashQuery.error} />
            )}
            {items.length === 0 &&
              !mediaQuery.isLoading &&
              !trashQuery.isLoading && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  {view === 'trash' ? 'Trash is empty.' : 'No files here. Upload some!'}
                </div>
              )}

            {gridMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {items.map((item) => (
                  <MediaItemGrid
                    key={item.id}
                    item={item}
                    selected={selected.has(item.id)}
                    onToggle={handleToggle}
                    onDetail={setDetailItem}
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
                    onDetail={setDetailItem}
                  />
                ))}
              </div>
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
          />
        )}
      </div>

      {/* PageHeader outside the flex (scroll context) */}
      <PageHeader title="Media Library" />

      {/* Create folder */}
      <Modal
        open={createFolderOpen}
        onClose={() => { setCreateFolderOpen(false); setNewFolderName('') }}
        title="New folder"
        footer={
          <>
            <Button variant="outline" onClick={() => setCreateFolderOpen(false)}>Cancel</Button>
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
          onKeyDown={(e) => e.key === 'Enter' && newFolderName.trim() && createFolderMutation.mutate()}
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
            <Button variant="outline" onClick={() => setRenameFolderTarget(null)}>Cancel</Button>
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
          onKeyDown={(e) => e.key === 'Enter' && renameFolderName.trim() && renameFolderMutation.mutate()}
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
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancel</Button>
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
    </PermissionGuard>
  )
}
