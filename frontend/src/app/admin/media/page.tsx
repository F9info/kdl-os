'use client'

import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Upload, FileImage, FileText, File } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePagination } from '@/hooks/usePagination'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/shared/DataTable'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import type { Media } from '@/types/models.types'

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />
  if (mimeType.startsWith('text/')) return <FileText className="h-4 w-4 text-green-500" />
  return <File className="h-4 w-4 text-muted-foreground" />
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function MediaPage() {
  const queryClient = useQueryClient()
  const { page, setPage } = usePagination()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['media', page],
    queryFn: () =>
      api
        .get('/media', { params: { page, limit: 10 } })
        .then((r) => r.data.data as { media: Media[]; pagination: { total: number; pages: number } }),
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return api.post('/media/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({ title: 'File uploaded' })
      if (fileInputRef.current) fileInputRef.current.value = ''
    },
    onError: () => {
      toast({ title: 'Upload failed', variant: 'destructive' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/media/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({ title: 'File deleted' })
      setDeleteId(null)
    },
  })

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadMutation.mutate(file)
  }

  const columns: ColumnDef<Media>[] = [
    {
      accessorKey: 'original_name',
      header: 'File',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {fileIcon(row.original.mime_type)}
          <div>
            <div className="font-medium text-sm truncate max-w-[200px]">
              {row.original.original_name}
            </div>
            <div className="text-xs text-muted-foreground">{row.original.mime_type}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ row }) => formatBytes(row.original.size),
    },
    {
      accessorKey: 'created_at',
      header: 'Uploaded',
      cell: ({ row }) => formatDate(row.original.created_at),
    },
    {
      accessorKey: 'url',
      header: 'Preview',
      cell: ({ row }) =>
        row.original.url ? (
          row.original.mime_type.startsWith('image/') ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.original.url}
              alt={row.original.original_name}
              className="h-10 w-10 object-cover rounded"
            />
          ) : (
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary underline"
            >
              Open
            </a>
          )
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={() => setDeleteId(row.original.id)}
          aria-label={`Delete ${row.original.original_name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Media" />

      <div className="mb-6 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt"
        />
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
        >
          <Upload className="h-4 w-4 mr-2" />
          {uploadMutation.isPending ? 'Uploading…' : 'Upload File'}
        </Button>
        {data && (
          <span className="text-sm text-muted-foreground">
            {data.pagination.total} file{data.pagination.total !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.media ?? []}
        isLoading={isLoading}
        emptyMessage="No files uploaded yet."
        pagination={
          data
            ? {
                page,
                totalPages: data.pagination.pages,
                onPageChange: setPage,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete file?"
        description="This will permanently remove the file from storage."
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
