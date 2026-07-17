'use client'

import { useState, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Upload, Check, X, File, FileImage, FileText, Film, Music } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Modal } from './Modal'
import { AppImage } from './AppImage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/useDebounce'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { Media, MediaType } from '@/types/media.types'

interface MediaPickerProps {
  open: boolean
  onClose: () => void
  onSelect: (media: Media[]) => void
  multiple?: boolean
  typeFilter?: MediaType
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-5 w-5 text-blue-400" />
  if (mimeType.startsWith('video/')) return <Film className="h-5 w-5 text-purple-400" />
  if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5 text-green-400" />
  if (mimeType === 'application/pdf' || mimeType.includes('document')) return <FileText className="h-5 w-5 text-red-400" />
  return <File className="h-5 w-5 text-muted-foreground" />
}

export function MediaPicker({ open, onClose, onSelect, multiple = false, typeFilter }: MediaPickerProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(search, 300)

  const params: Record<string, string> = { limit: '48' }
  if (debouncedSearch) params.search = debouncedSearch
  if (typeFilter) params.type = typeFilter

  const { data, isLoading } = useQuery({
    queryKey: ['media-picker', debouncedSearch, typeFilter],
    queryFn: () => api.get('/media', { params }).then((r) => r.data.data as { media: Media[] }),
    enabled: open,
  })

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      setUploading(true)
      const fd = new FormData()
      Array.from(files).forEach((f) => fd.append('files', f))
      return api.post('/media/upload', fd)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-picker'] })
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({ title: 'File(s) uploaded' })
    },
    onError: () => toast({ title: 'Upload failed', variant: 'destructive' }),
    onSettled: () => setUploading(false),
  })

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (!multiple) {
        next.clear()
        next.add(id)
        return next
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [multiple])

  const handleConfirm = () => {
    const selected = (data?.media ?? []).filter((m) => selectedIds.has(m.id))
    onSelect(selected)
    setSelectedIds(new Set())
    onClose()
  }

  const handleClose = () => {
    setSelectedIds(new Set())
    onClose()
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.files.length) uploadMutation.mutate(e.dataTransfer.files)
  }, [uploadMutation])

  const media = data?.media ?? []

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Select Media"
      size="lg"
      footer={
        <div className="flex justify-between w-full">
          <span className="text-sm text-muted-foreground self-center">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'No selection'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Select{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            title="Upload files"
          >
            <Upload className="h-4 w-4" />
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && uploadMutation.mutate(e.target.files)}
          />
        </div>

        <div
          className="min-h-[320px] border rounded-md"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          {isLoading ? (
            <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">Loading…</div>
          ) : media.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[320px] text-muted-foreground text-sm gap-2">
              <Upload className="h-8 w-8 opacity-40" />
              <span>No files. Drop files here or click upload.</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 p-2">
              {media.map((item) => {
                const isSelected = selectedIds.has(item.id)
                const thumb = item.variants?.thumb ?? item.url
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleSelect(item.id)}
                    className={cn(
                      'relative rounded border-2 p-1 text-left transition-all hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary',
                      isSelected ? 'border-primary bg-primary/5' : 'border-transparent'
                    )}
                  >
                    {item.mime_type.startsWith('image/') && thumb ? (
                      <AppImage
                        size="thumbnail"
                        src={thumb}
                        alt={item.original_name}
                        className="max-w-full rounded"
                      />
                    ) : (
                      <div className="w-full aspect-square flex items-center justify-center bg-muted rounded">
                        {fileIcon(item.mime_type)}
                      </div>
                    )}
                    <p className="text-xs mt-1 truncate text-muted-foreground">{item.original_name}</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(item.size)}</p>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
