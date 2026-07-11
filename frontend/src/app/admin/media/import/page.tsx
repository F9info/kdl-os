'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Cloud, Trash2, FolderOpen, Folder, File as FileIcon, ChevronLeft } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { Modal } from '@/components/shared/Modal'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, formatBytes } from '@/lib/utils'
import {
  OAUTH_PROVIDERS, MANUAL_PROVIDERS, PROVIDER_LABELS, MANUAL_PROVIDER_FIELDS,
  type ImportProvider, type ImportProviderStatus, type ImportConnection,
  type RemoteFile, type RemoteFileList, type ImportResult,
} from '@/types/media-import.types'

const importApi = {
  providers: () => api.get('/media/import/providers').then((r) => r.data.data.items as ImportProviderStatus[]),
  connections: () => api.get('/media/import/connections').then((r) => r.data.data.items as ImportConnection[]),
  createConnection: (body: { provider: string; label: string; credentials: Record<string, unknown> }) =>
    api.post('/media/import/connections', body),
  deleteConnection: (id: string) => api.delete(`/media/import/connections/${id}`),
  startOAuth: (provider: string) =>
    api.get(`/media/import/oauth/${provider}/start`).then((r) => r.data.data.url as string),
  listFiles: (id: string, folderId: string | null, cursor: string | null) =>
    api
      .get(`/media/import/connections/${id}/files`, { params: { folder_id: folderId ?? undefined, cursor: cursor ?? undefined } })
      .then((r) => r.data.data as RemoteFileList),
  importFiles: (id: string, fileIds: string[]) =>
    api.post(`/media/import/connections/${id}/import`, { file_ids: fileIds }).then((r) => r.data.data as ImportResult),
}

function ManualConnectionForm({ onCreated }: { onCreated: () => void }) {
  const [provider, setProvider] = useState<'s3' | 'ftp'>('s3')
  const [label, setLabel] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)

  const fieldDefs = MANUAL_PROVIDER_FIELDS[provider]

  const createMutation = useMutation({
    mutationFn: () => {
      const credentials: Record<string, unknown> = {}
      for (const f of fieldDefs) {
        if (f.type === 'checkbox') credentials[f.key] = fields[f.key] === 'true'
        else if (fields[f.key]?.trim()) credentials[f.key] = fields[f.key]
      }
      return importApi.createConnection({ provider, label, credentials })
    },
    onSuccess: () => {
      setLabel('')
      setFields({})
      setError(null)
      toast({ title: 'Connection added' })
      onCreated()
    },
    onError: (err) => setError(err),
  })

  function handleSubmit() {
    if (!label.trim()) {
      setError('Label is required')
      return
    }
    for (const f of fieldDefs.filter((f) => f.required)) {
      if (!fields[f.key]?.trim()) {
        setError(`${f.label} is required`)
        return
      }
    }
    setError(null)
    createMutation.mutate()
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="text-sm font-medium">Add S3 / FTP connection</div>
      <ErrorAlert error={error} />
      <FormField label="Provider" required>
        <Select value={provider} onValueChange={(v) => { setProvider(v as 's3' | 'ftp'); setFields({}) }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {MANUAL_PROVIDERS.map((p) => (
              <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
      <FormField label="Label" required>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Backups bucket" />
      </FormField>
      {fieldDefs.map((f) => (
        <FormField key={f.key} label={f.label} required={f.required}>
          {f.type === 'checkbox' ? (
            <input
              type="checkbox"
              className="h-4 w-4 rounded border"
              checked={fields[f.key] === 'true'}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: String(e.target.checked) }))}
            />
          ) : (
            <Input
              type={f.type === 'password' ? 'password' : 'text'}
              value={fields[f.key] ?? ''}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              autoComplete="new-password"
            />
          )}
        </FormField>
      ))}
      <Button size="sm" onClick={handleSubmit} disabled={createMutation.isPending}>
        {createMutation.isPending ? 'Adding…' : 'Add connection'}
      </Button>
    </div>
  )
}

function FileBrowserModal({ connection, onClose }: { connection: ImportConnection; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [stack, setStack] = useState<{ id: string | null; name: string }[]>([{ id: null, name: PROVIDER_LABELS[connection.provider] }])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const current = stack[stack.length - 1] ?? { id: null, name: '' }

  const { data, isLoading, error } = useQuery({
    queryKey: ['import-files', connection.id, current.id],
    queryFn: () => importApi.listFiles(connection.id, current.id, null),
  })

  const importMutation = useMutation({
    mutationFn: () => importApi.importFiles(connection.id, Array.from(selected)),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      toast({
        title: `Imported ${result.imported.length} file(s)`,
        description: result.skipped.length ? `${result.skipped.length} skipped` : undefined,
      })
      setSelected(new Set())
      onClose()
    },
    onError: () => toast({ title: 'Import failed', variant: 'destructive' }),
  })

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function enterFolder(file: RemoteFile) {
    setStack((prev) => [...prev, { id: file.id, name: file.name }])
    setSelected(new Set())
  }

  function goBack() {
    if (stack.length <= 1) return
    setStack((prev) => prev.slice(0, -1))
    setSelected(new Set())
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Browse — ${connection.label}`}
      size="lg"
      footer={
        <div className="flex justify-between items-center w-full">
          <span className="text-sm text-muted-foreground">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={selected.size === 0 || importMutation.isPending}
            >
              {importMutation.isPending ? 'Importing…' : `Import ${selected.size || ''}`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {stack.length > 1 && (
            <button onClick={goBack} className="p-1 rounded hover:bg-accent" aria-label="Back">
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span>{stack.map((s) => s.name).join(' / ')}</span>
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : error ? (
          <ErrorAlert error={error} />
        ) : !data || data.items.length === 0 ? (
          <div className="text-sm text-muted-foreground py-8 text-center">No files here.</div>
        ) : (
          <ul className="divide-y border rounded-md">
            {data.items.map((file) => (
              <li key={file.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                {file.isFolder ? (
                  <button
                    type="button"
                    onClick={() => enterFolder(file)}
                    className="flex items-center gap-2 flex-1 text-left hover:underline"
                  >
                    <Folder className="h-4 w-4 text-muted-foreground" /> {file.name}
                  </button>
                ) : (
                  <>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border"
                      checked={selected.has(file.id)}
                      onChange={() => toggle(file.id)}
                      aria-label={`Select ${file.name}`}
                    />
                    <FileIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1">{file.name}</span>
                    {file.size != null && (
                      <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function MediaImportContent() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [browsing, setBrowsing] = useState<ImportConnection | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data: providers = [] } = useQuery({
    queryKey: ['import-providers'],
    queryFn: importApi.providers,
  })
  const { data: connections = [], isLoading } = useQuery({
    queryKey: ['import-connections'],
    queryFn: importApi.connections,
  })

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected) {
      toast({ title: `${PROVIDER_LABELS[connected as ImportProvider] ?? connected} connected` })
      queryClient.invalidateQueries({ queryKey: ['import-connections'] })
      router.replace('/admin/media/import')
    } else if (error) {
      toast({ title: 'Connection failed', description: error, variant: 'destructive' })
      router.replace('/admin/media/import')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const oauthMutation = useMutation({
    mutationFn: (provider: string) => importApi.startOAuth(provider),
    onSuccess: (url) => { window.location.href = url },
    onError: () => toast({ title: 'Could not start OAuth flow', variant: 'destructive' }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => importApi.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-connections'] })
      setDeleteId(null)
      toast({ title: 'Connection removed' })
    },
    onError: () => { setDeleteId(null); toast({ title: 'Delete failed', variant: 'destructive' }) },
  })

  const statusFor = (p: ImportProvider) => providers.find((s) => s.provider === p)

  return (
    <PermissionGuard permission="media:cloud-import">
      <div>
        <PageHeader title="Cloud Imports" />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {OAUTH_PROVIDERS.filter((p) => statusFor(p)?.configured).map((p) => (
            <div key={p} className="rounded-lg border bg-card p-4 flex items-center justify-between gap-2">
              <div>
                <div className="font-medium text-sm">{PROVIDER_LABELS[p]}</div>
                <div className="text-xs text-muted-foreground">OAuth</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => oauthMutation.mutate(p)} disabled={oauthMutation.isPending}>
                <Cloud className="h-4 w-4 mr-1" /> Connect
              </Button>
            </div>
          ))}
          {OAUTH_PROVIDERS.every((p) => !statusFor(p)?.configured) && (
            <div className="text-sm text-muted-foreground sm:col-span-2 lg:col-span-3">
              No cloud OAuth providers are configured on this server — Google Drive, Dropbox, and OneDrive are
              hidden until an admin sets their app credentials.
            </div>
          )}
        </div>

        <ManualConnectionForm onCreated={() => queryClient.invalidateQueries({ queryKey: ['import-connections'] })} />

        <div className="mt-6">
          <div className="text-sm font-medium mb-2">Connections</div>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : connections.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-md">
              No cloud import connections yet.
            </div>
          ) : (
            <ul className="divide-y border rounded-md">
              {connections.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{c.label}</span>{' '}
                    <span className="text-xs text-muted-foreground">({PROVIDER_LABELS[c.provider]})</span>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setBrowsing(c)}>
                      <FolderOpen className="h-4 w-4 mr-1" /> Browse
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(c.id)}
                      aria-label="Remove connection"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {browsing && <FileBrowserModal connection={browsing} onClose={() => setBrowsing(null)} />}

        <ConfirmDialog
          open={!!deleteId}
          onClose={() => setDeleteId(null)}
          onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
          title="Remove Connection"
          description="This connection will be removed. This cannot be undone."
          confirmLabel="Remove"
          variant="destructive"
        />
      </div>
    </PermissionGuard>
  )
}

export default function MediaImportPage() {
  return (
    <Suspense fallback={<div className="text-sm text-muted-foreground p-6">Loading…</div>}>
      <MediaImportContent />
    </Suspense>
  )
}
