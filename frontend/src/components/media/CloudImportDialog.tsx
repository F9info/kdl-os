'use client'

// KDL Phase D8 — Cloud import dialog: manage cloud-storage connections
// (OAuth: Google Drive / Dropbox / OneDrive; credentials: S3 / FTP), browse a
// connection's files, and import a selection into the media library.

import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Cloud, Folder as FolderIcon, File as FileIcon, ChevronRight, ArrowLeft, Trash2, Plus } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatBytes, cn } from '@/lib/utils'

// ─── Backend contract types ───────────────────────────────────────────────────

export type CloudProvider = 'gdrive' | 'dropbox' | 'onedrive' | 's3' | 'ftp'

export interface ImportProvider {
  provider: CloudProvider
  auth: 'oauth' | 'credentials'
  configured: boolean
}

export interface ImportConnection {
  id: string
  provider: CloudProvider
  label: string
  created_at: string
  updated_at: string
}

export interface BrowseEntry {
  id: string
  name: string
  size: number
  mime: string | null
  is_folder: boolean
}

export interface ImportResult {
  imported: { id: string; name: string }[]
  skipped: { file: string; reason: string }[]
}

export const PROVIDER_LABELS: Record<CloudProvider, string> = {
  gdrive: 'Google Drive',
  dropbox: 'Dropbox',
  onedrive: 'OneDrive',
  s3: 'Amazon S3',
  ftp: 'FTP',
}

const OAUTH_CALLBACK_PATH = '/admin/media/import/callback'

// ─── API helpers ──────────────────────────────────────────────────────────────

const importApi = {
  providers: () =>
    api.get('/media/import/providers').then((r) => (r.data.data?.items ?? []) as ImportProvider[]),
  connections: () =>
    api.get('/media/import/connections').then((r) => (r.data.data?.items ?? []) as ImportConnection[]),
  createConnection: (data: { provider: 's3' | 'ftp'; label: string; credentials: Record<string, unknown> }) =>
    api.post('/media/import/connections', data).then((r) => r.data.data as ImportConnection),
  deleteConnection: (id: string) => api.delete(`/media/import/connections/${id}`),
  oauthUrl: (provider: CloudProvider, redirect_uri: string) =>
    api.post(`/media/import/oauth/${provider}/url`, { redirect_uri })
      .then((r) => r.data.data as { url: string; state: string }),
  oauthCallback: (provider: CloudProvider, body: { code: string; state: string; redirect_uri: string; label?: string }) =>
    api.post(`/media/import/oauth/${provider}/callback`, body).then((r) => r.data.data as ImportConnection),
  browse: (id: string, params: { path?: string; cursor?: string }) =>
    api.get(`/media/import/connections/${id}/browse`, { params })
      .then((r) => r.data.data as { entries: BrowseEntry[]; cursor: string | null }),
  importFiles: (id: string, files: string[], folder_id?: string | null) =>
    api.post(`/media/import/connections/${id}/import`, {
      files,
      ...(folder_id ? { folder_id } : {}),
    }).then((r) => r.data.data as ImportResult),
}

// ─── Credential forms (S3 / FTP) ──────────────────────────────────────────────

function S3CredentialForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState('')
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')
  const [bucket, setBucket] = useState('')
  const [region, setRegion] = useState('')
  const [endpoint, setEndpoint] = useState('')

  const createMut = useMutation({
    mutationFn: () =>
      importApi.createConnection({
        provider: 's3',
        label: label.trim(),
        credentials: {
          access_key_id: accessKeyId.trim(),
          secret_access_key: secretAccessKey,
          bucket: bucket.trim(),
          ...(region.trim() ? { region: region.trim() } : {}),
          ...(endpoint.trim() ? { endpoint: endpoint.trim() } : {}),
        },
      }),
    onSuccess: () => { toast({ title: 'Connection added' }); onCreated() },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add connection'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const valid = label.trim() && accessKeyId.trim() && secretAccessKey && bucket.trim()

  return (
    <div className="border rounded p-3 space-y-2 bg-muted/30">
      <p className="text-sm font-medium">Connect Amazon S3</p>
      <Input placeholder="Connection label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Access key ID" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Secret access key" type="password" value={secretAccessKey} onChange={(e) => setSecretAccessKey(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Region (optional)" value={region} onChange={(e) => setRegion(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Endpoint (optional)" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} className="h-8 text-sm" />
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!valid || createMut.isPending}>
          {createMut.isPending ? 'Saving…' : 'Save connection'}
        </Button>
      </div>
    </div>
  )
}

function FtpCredentialForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [label, setLabel] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('')
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [secure, setSecure] = useState(false)

  const createMut = useMutation({
    mutationFn: () =>
      importApi.createConnection({
        provider: 'ftp',
        label: label.trim(),
        credentials: {
          host: host.trim(),
          ...(port.trim() ? { port: Number(port) } : {}),
          user: user.trim(),
          password,
          secure,
        },
      }),
    onSuccess: () => { toast({ title: 'Connection added' }); onCreated() },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to add connection'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const valid = label.trim() && host.trim() && user.trim() && password

  return (
    <div className="border rounded p-3 space-y-2 bg-muted/30">
      <p className="text-sm font-medium">Connect FTP</p>
      <Input placeholder="Connection label" value={label} onChange={(e) => setLabel(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Host" value={host} onChange={(e) => setHost(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Port (optional)" type="number" value={port} onChange={(e) => setPort(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="User" value={user} onChange={(e) => setUser(e.target.value)} className="h-8 text-sm" />
      <Input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-8 text-sm" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="h-4 w-4 rounded" />
        Use FTPS (secure)
      </label>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => createMut.mutate()} disabled={!valid || createMut.isPending}>
          {createMut.isPending ? 'Saving…' : 'Save connection'}
        </Button>
      </div>
    </div>
  )
}

// ─── Connections step ─────────────────────────────────────────────────────────

function ConnectionsStep({ onOpen }: { onOpen: (c: ImportConnection) => void }) {
  const queryClient = useQueryClient()
  const [credForm, setCredForm] = useState<'s3' | 'ftp' | null>(null)
  const pendingOauth = useRef<CloudProvider | null>(null)

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
    [queryClient],
  )

  const deleteMut = useMutation({
    mutationFn: (id: string) => importApi.deleteConnection(id),
    onSuccess: invalidateConnections,
    onError: () => toast({ title: 'Failed to remove connection', variant: 'destructive' }),
  })

  // OAuth popup flow: the callback page posts { type, code, state } back to us.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const d = e.data as { type?: string; code?: string; state?: string } | null
      if (!d || d.type !== 'media-import-oauth' || !d.code || !d.state) return
      const provider = pendingOauth.current
      if (!provider) return
      pendingOauth.current = null
      importApi
        .oauthCallback(provider, {
          code: d.code,
          state: d.state,
          redirect_uri: window.location.origin + OAUTH_CALLBACK_PATH,
        })
        .then(() => { toast({ title: 'Connection added' }); invalidateConnections() })
        .catch(() => toast({ title: 'Failed to complete authorization', variant: 'destructive' }))
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [invalidateConnections])

  const startOauth = async (provider: CloudProvider) => {
    try {
      const redirect_uri = window.location.origin + OAUTH_CALLBACK_PATH
      const { url } = await importApi.oauthUrl(provider, redirect_uri)
      pendingOauth.current = provider
      window.open(url, 'media-import-oauth', 'width=600,height=700')
    } catch {
      toast({ title: 'Failed to start authorization', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Connections</p>
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (connections ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">No connections yet. Add one below.</p>
        )}
        {(connections ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-2 border rounded px-2 py-1.5">
            <Cloud className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Badge variant="outline" className="text-[10px]">{PROVIDER_LABELS[c.provider] ?? c.provider}</Badge>
            <span className="text-sm truncate flex-1">{c.label}</span>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onOpen(c)}>
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
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Add connection</p>
        <div className="flex flex-wrap gap-2">
          {(providers ?? []).map((p) => {
            const label = PROVIDER_LABELS[p.provider] ?? p.provider
            if (p.auth === 'oauth') {
              return (
                <div key={p.provider} className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!p.configured}
                    onClick={() => startOauth(p.provider)}
                    title={p.configured ? `Connect ${label}` : `${label} is not configured on the server`}
                  >
                    <Plus className="h-3 w-3 mr-1" /> {label}
                  </Button>
                  {!p.configured && (
                    <span className="text-[10px] text-muted-foreground">Not configured</span>
                  )}
                </div>
              )
            }
            return (
              <Button
                key={p.provider}
                size="sm"
                variant="outline"
                onClick={() => setCredForm(p.provider as 's3' | 'ftp')}
                title={`Connect ${label}`}
              >
                <Plus className="h-3 w-3 mr-1" /> {label}
              </Button>
            )
          })}
        </div>
        {credForm === 's3' && (
          <S3CredentialForm
            onCreated={() => { setCredForm(null); invalidateConnections() }}
            onCancel={() => setCredForm(null)}
          />
        )}
        {credForm === 'ftp' && (
          <FtpCredentialForm
            onCreated={() => { setCredForm(null); invalidateConnections() }}
            onCancel={() => setCredForm(null)}
          />
        )}
      </div>
    </div>
  )
}

// ─── Browser step ─────────────────────────────────────────────────────────────

function ConnectionBrowser({
  connection, folderId, onImported,
}: {
  connection: ImportConnection
  folderId?: string | null
  onImported?: (result: ImportResult) => void
}) {
  const [pathStack, setPathStack] = useState<{ id: string; name: string }[]>([])
  const [entries, setEntries] = useState<BrowseEntry[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const currentPath = pathStack[pathStack.length - 1]?.id

  const load = useCallback(async (append: boolean, cur?: string | null) => {
    setLoading(true)
    try {
      const data = await importApi.browse(connection.id, {
        ...(currentPath ? { path: currentPath } : {}),
        ...(cur ? { cursor: cur } : {}),
      })
      setEntries((prev) => (append ? [...prev, ...data.entries] : data.entries))
      setCursor(data.cursor ?? null)
    } catch {
      toast({ title: 'Failed to browse connection', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [connection.id, currentPath])

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
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Import failed'
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
              className={cn('hover:underline', i === pathStack.length - 1 ? 'font-medium' : 'text-primary')}
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
          e.is_folder ? (
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
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatBytes(e.size)}</span>
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
          {importing ? 'Importing…' : `Import ${selected.size} file${selected.size !== 1 ? 's' : ''}`}
        </Button>
      </div>

      {/* Result summary */}
      {result && (
        <div className="border rounded p-3 space-y-1 text-sm bg-muted/30" role="status">
          <p className="font-medium">
            {result.imported.length} file{result.imported.length !== 1 ? 's' : ''} imported
            {result.skipped.length > 0 && `, ${result.skipped.length} skipped`}
          </p>
          {result.skipped.map((s, i) => (
            <p key={i} className="text-xs text-destructive">
              {s.file}: {s.reason}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" role="dialog" aria-label="Import from cloud">
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
          <button type="button" title="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {activeConnection ? (
          <ConnectionBrowser connection={activeConnection} folderId={folderId} onImported={onImported} />
        ) : (
          <ConnectionsStep onOpen={setActiveConnection} />
        )}
      </div>
    </div>
  )
}
