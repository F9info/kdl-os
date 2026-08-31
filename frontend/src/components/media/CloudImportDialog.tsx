'use client'

// KDL Phase D8 — Cloud import dialog: manage cloud-storage connections
// (OAuth: Google Drive / Dropbox / OneDrive; credentials: S3 / FTP), browse a
// connection's files, and import a selection into the media library.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  X,
  Cloud,
  Folder as FolderIcon,
  File as FileIcon,
  ChevronRight,
  ArrowLeft,
  Trash2,
  Plus,
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatBytes, cn } from '@/lib/utils'
import {
  OAUTH_PROVIDERS,
  MANUAL_PROVIDERS,
  PROVIDER_LABELS,
  MANUAL_PROVIDER_FIELDS,
  type ImportProvider,
  type ImportProviderStatus,
  type ImportConnection,
  type RemoteFile,
  type RemoteFileList,
  type ImportResult,
} from '@/types/media-import.types'

// ─── API helpers ──────────────────────────────────────────────────────────────

const importApi = {
  providers: () =>
    api
      .get('/media/import/providers')
      .then((r) => (r.data.data?.items ?? []) as ImportProviderStatus[]),
  connections: () =>
    api
      .get('/media/import/connections')
      .then((r) => (r.data.data?.items ?? []) as ImportConnection[]),
  createConnection: (data: {
    provider: string
    label: string
    credentials: Record<string, unknown>
  }) => api.post('/media/import/connections', data).then((r) => r.data.data as ImportConnection),
  deleteConnection: (id: string) => api.delete(`/media/import/connections/${id}`),
  oauthStart: (provider: ImportProvider) =>
    api.get(`/media/import/oauth/${provider}/start`).then((r) => r.data.data as { url: string }),
  browse: (id: string, params: { folder_id?: string; cursor?: string }) =>
    api
      .get(`/media/import/connections/${id}/files`, { params })
      .then((r) => r.data.data as RemoteFileList),
  importFiles: (id: string, file_ids: string[], folder_id?: string | null) =>
    api
      .post(`/media/import/connections/${id}/import`, {
        file_ids,
        ...(folder_id ? { folder_id } : {}),
      })
      .then((r) => r.data.data as ImportResult),
}

// ─── Credential forms (S3 / FTP) ──────────────────────────────────────────────

function ManualConnectionForm({
  onCreated,
  onCancel,
}: {
  onCreated: () => void
  onCancel: () => void
}) {
  const [provider, setProvider] = useState<'s3' | 'ftp'>('s3')
  const [label, setLabel] = useState('')
  const [fields, setFields] = useState<Record<string, string>>({})

  const fieldDefs = MANUAL_PROVIDER_FIELDS[provider]

  const createMut = useMutation({
    mutationFn: () => {
      const credentials: Record<string, unknown> = {}
      for (const f of fieldDefs) {
        if (f.type === 'checkbox') credentials[f.key] = fields[f.key] === 'true'
        else if (fields[f.key]?.trim()) credentials[f.key] = fields[f.key]
      }
      return importApi.createConnection({ provider, label: label.trim(), credentials })
    },
    onSuccess: () => {
      toast({ title: 'Connection added' })
      onCreated()
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to add connection'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const valid =
    label.trim() && fieldDefs.filter((f) => f.required).every((f) => fields[f.key]?.trim())

  return (
    <div className="border rounded p-3 space-y-2 bg-muted/30">
      <p className="text-sm font-medium">Add connection</p>
      <div className="flex gap-2">
        {MANUAL_PROVIDERS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => {
              setProvider(p as 's3' | 'ftp')
              setFields({})
            }}
            className={cn(
              'px-3 py-1 text-xs rounded border',
              provider === p ? 'bg-accent font-medium' : 'hover:bg-accent/50'
            )}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>
      <Input
        placeholder="Connection label"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="h-8 text-sm"
      />
      {fieldDefs.map((f) =>
        f.type === 'checkbox' ? (
          <label key={f.key} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fields[f.key] === 'true'}
              onChange={(e) =>
                setFields((prev) => ({ ...prev, [f.key]: String(e.target.checked) }))
              }
              className="h-4 w-4 rounded"
            />
            {f.label}
          </label>
        ) : (
          <Input
            key={f.key}
            placeholder={f.label + (f.required ? '' : ' (optional)')}
            type={f.type === 'password' ? 'password' : 'text'}
            value={fields[f.key] ?? ''}
            onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
            className="h-8 text-sm"
          />
        )
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={() => createMut.mutate()}
          disabled={!valid || createMut.isPending}
        >
          {createMut.isPending ? 'Saving…' : 'Save connection'}
        </Button>
      </div>
    </div>
  )
}

// ─── Connections step ─────────────────────────────────────────────────────────

function ConnectionsStep({ onOpen }: { onOpen: (c: ImportConnection) => void }) {
  const queryClient = useQueryClient()
  const [credForm, setCredForm] = useState(false)
  const popupRef = useRef<Window | null>(null)

  const { data: providers } = useQuery({
    queryKey: ['media-import-providers'],
    queryFn: importApi.providers,
  })
  const { data: connections, isLoading } = useQuery({
    queryKey: ['media-import-connections'],
    queryFn: importApi.connections,
  })

  const invalidateConnections = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['media-import-connections'] }),
    [queryClient]
  )

  const deleteMut = useMutation({
    mutationFn: (id: string) => importApi.deleteConnection(id),
    onSuccess: invalidateConnections,
    onError: () => toast({ title: 'Failed to remove connection', variant: 'destructive' }),
  })

  const startOauth = async (provider: ImportProvider) => {
    try {
      const { url } = await importApi.oauthStart(provider)
      const popup = window.open(url, 'media-import-oauth', 'width=600,height=700')
      if (!popup) {
        toast({ title: 'Allow popups to connect cloud storage', variant: 'destructive' })
        return
      }
      popupRef.current = popup
      // Refresh connections once the OAuth popup completes and closes.
      // The backend redirects back to /admin/media/import?connected=... so the
      // popup lands on the import page, not a postMessage callback page.
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer)
          popupRef.current = null
          invalidateConnections()
        }
      }, 500)
    } catch {
      toast({ title: 'Failed to start authorization', variant: 'destructive' })
    }
  }

  const oauthProviders = (providers ?? []).filter((p) => p.oauth)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Connections
        </p>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (connections ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No connections yet. Add one below.</p>
        )}
        {(connections ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-2 border rounded px-2 py-1.5">
            <Cloud className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Badge variant="outline" className="text-[10px]">
              {PROVIDER_LABELS[c.provider] ?? c.provider}
            </Badge>
            <span className="text-sm truncate flex-1">{c.label}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => onOpen(c)}
            >
              Browse
            </Button>
            <button
              type="button"
              title={`Delete connection ${c.label}`}
              className="p-1 rounded hover:text-destructive text-muted-foreground"
              onClick={() => deleteMut.mutate(c.id)}
              disabled={deleteMut.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          Add connection
        </p>
        <div className="flex flex-wrap gap-2">
          {oauthProviders.map((p) => {
            const label = PROVIDER_LABELS[p.provider] ?? p.provider
            return (
              <div key={p.provider} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!p.configured}
                  onClick={() => startOauth(p.provider)}
                  title={
                    p.configured ? `Connect ${label}` : `${label} is not configured on the server`
                  }
                >
                  <Plus className="h-3 w-3" /> {label}
                </Button>
                {!p.configured && (
                  <span className="text-[10px] text-muted-foreground">Not configured</span>
                )}
              </div>
            )
          })}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCredForm(true)}
            title="Connect S3 or FTP"
          >
            <Plus className="h-3 w-3" /> S3 / FTP
          </Button>
        </div>
        {credForm && (
          <ManualConnectionForm
            onCreated={() => {
              setCredForm(false)
              invalidateConnections()
            }}
            onCancel={() => setCredForm(false)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Browser step ─────────────────────────────────────────────────────────────

function ConnectionBrowser({
  connection,
  folderId,
  onImported,
}: {
  connection: ImportConnection
  folderId?: string | null
  onImported?: (result: ImportResult) => void
}) {
  const [pathStack, setPathStack] = useState<{ id: string; name: string }[]>([])
  const [entries, setEntries] = useState<RemoteFile[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const currentFolderId = pathStack[pathStack.length - 1]?.id ?? undefined

  const load = useCallback(
    async (append: boolean, cur?: string | null) => {
      setLoading(true)
      try {
        const data = await importApi.browse(connection.id, {
          ...(currentFolderId ? { folder_id: currentFolderId } : {}),
          ...(cur ? { cursor: cur } : {}),
        })
        setEntries((prev) => (append ? [...prev, ...data.items] : data.items))
        setCursor(data.nextCursor ?? null)
      } catch {
        toast({ title: 'Failed to browse connection', variant: 'destructive' })
      } finally {
        setLoading(false)
      }
    },
    [connection.id, currentFolderId]
  )

  // (Re)load whenever the connection or current folder changes
  useEffect(() => {
    setSelected(new Set())
    setEntries([])
    setCursor(null)
    load(false)
  }, [load])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const runImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      const res = await importApi.importFiles(connection.id, Array.from(selected), folderId ?? null)
      setResult(res)
      setSelected(new Set())
      onImported?.(res)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Import failed'
      toast({ title: msg, variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button
          type="button"
          className="hover:underline text-primary"
          onClick={() => setPathStack([])}
        >
          {connection.label}
        </button>
        {pathStack.map((p, i) => (
          <span key={p.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
            <button
              type="button"
              className={cn(
                'hover:underline',
                i === pathStack.length - 1 ? 'font-medium' : 'text-primary'
              )}
              onClick={() => setPathStack((prev) => prev.slice(0, i + 1))}
            >
              {p.name}
            </button>
          </span>
        ))}
      </div>

      {/* Entries */}
      <div className="border rounded max-h-72 overflow-y-auto divide-y">
        {loading && entries.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">Loading…</p>
        )}
        {!loading && entries.length === 0 && (
          <p className="p-3 text-sm text-muted-foreground">This folder is empty.</p>
        )}
        {entries.map((e) =>
          e.isFolder ? (
            <button
              key={e.id}
              type="button"
              className="flex items-center gap-2 px-3 py-1.5 w-full text-left text-sm hover:bg-accent"
              onClick={() => setPathStack((prev) => [...prev, { id: e.id, name: e.name }])}
            >
              <FolderIcon className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="truncate flex-1">{e.name}</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ) : (
            <label
              key={e.id}
              className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent cursor-pointer"
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={selected.has(e.id)}
                onChange={() => toggle(e.id)}
                aria-label={`Select ${e.name}`}
              />
              <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{e.name}</span>
              {e.size != null && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatBytes(e.size)}
                </span>
              )}
            </label>
          )
        )}
      </div>

      {cursor && (
        <Button size="sm" variant="outline" onClick={() => load(true, cursor)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </Button>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.size} file{selected.size !== 1 ? 's' : ''} selected
        </span>
        <Button size="sm" onClick={runImport} disabled={selected.size === 0 || importing}>
          {importing
            ? 'Importing…'
            : `Import ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {/* Result summary */}
      {result && (
        <div className="border rounded p-3 space-y-1 text-sm bg-muted/30" role="status">
          <p className="font-medium">
            {(result.imported ?? []).length} file{(result.imported ?? []).length !== 1 ? 's' : ''}{' '}
            imported
            {(result.skipped ?? []).length > 0 && `, ${(result.skipped ?? []).length} skipped`}
          </p>
          {(result.skipped ?? []).map((s, i) => (
            <p key={i} className="text-xs text-destructive">
              {s.file_id}: {s.reason}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Dialog shell ─────────────────────────────────────────────────────────────

export interface CloudImportDialogProps {
  folderId?: string | null
  onClose: () => void
  onImported?: (result: ImportResult) => void
}

export function CloudImportDialog({ folderId, onClose, onImported }: CloudImportDialogProps) {
  const [activeConnection, setActiveConnection] = useState<ImportConnection | null>(null)

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-label="Import from cloud"
    >
      <div className="bg-background rounded-lg shadow-xl p-6 w-[640px] max-w-[95vw] max-h-[85vh] overflow-y-auto space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            {activeConnection && (
              <button
                type="button"
                title="Back to connections"
                className="p-1 rounded hover:bg-accent"
                onClick={() => setActiveConnection(null)}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Cloud className="h-5 w-5" /> Import from cloud
          </h3>
          <button
            type="button"
            title="Close"
            onClick={onClose}
            className="rounded-sm text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {activeConnection ? (
          <ConnectionBrowser
            connection={activeConnection}
            folderId={folderId}
            onImported={onImported}
          />
        ) : (
          <ConnectionsStep onOpen={setActiveConnection} />
        )}
      </div>
    </div>
  )
}

// Re-export types used by parent pages so they don't need to import from two places.
export type { ImportConnection, ImportResult }
export { PROVIDER_LABELS, OAUTH_PROVIDERS, MANUAL_PROVIDERS }
