'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Package,
  Lock,
  CheckCircle,
  XCircle,
  Settings,
  Search,
  Image,
  Sparkles,
  Shield,
  Activity,
  Users,
  Box,
  FileText,
  LayoutGrid,
  AlertTriangle,
} from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Module, ModuleStatus, ModuleConflict } from '@/types/models.types'

const MODULE_ICON_MAP: Record<string, React.ElementType> = {
  Image,
  Package,
  Box,
  FileText,
  Settings,
  Activity,
  Lock,
  Shield,
  Users,
  Sparkles,
}

function ModuleIcon({ icon }: { icon: string | null }) {
  const Icon = (icon ? MODULE_ICON_MAP[icon] : null) ?? Package
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
      <Icon className="h-5 w-5 text-muted-foreground" />
    </div>
  )
}

const STATUS_META: Record<
  ModuleStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  AVAILABLE: { label: 'Available', variant: 'outline' },
  INSTALLED: { label: 'Installed', variant: 'secondary' },
  ENABLED: { label: 'Enabled', variant: 'default' },
  DISABLED: { label: 'Disabled', variant: 'destructive' },
}

function StatusBadgeModule({ status }: { status: ModuleStatus }) {
  const { label, variant } = STATUS_META[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={variant}>{label}</Badge>
}

type StatusFilter = 'ALL' | ModuleStatus

type Action = 'install' | 'enable' | 'disable'

interface ConfirmState {
  open: boolean
  slug: string
  action: Action
}

interface SwitchDialogState {
  open: boolean
  slug: string
  moduleName: string
  action: 'install' | 'enable'
  conflicts: ModuleConflict[]
}

interface SettingsState {
  open: boolean
  slug: string
  value: string
}

interface ApiError {
  response?: {
    data?: {
      message?: string
      code?: string
      details?: { conflicts?: ModuleConflict[] }
    }
  }
  message: string
}

export default function ModulesPage() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, slug: '', action: 'enable' })
  const [switchDialog, setSwitchDialog] = useState<SwitchDialogState>({
    open: false,
    slug: '',
    moduleName: '',
    action: 'enable',
    conflicts: [],
  })
  const [settingsDialog, setSettingsDialog] = useState<SettingsState>({
    open: false,
    slug: '',
    value: '',
  })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [showInternal, setShowInternal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: () => api.get('/modules').then((r) => r.data.data.modules as Module[]),
    staleTime: 30 * 1000,
  })

  const mutation = useMutation({
    mutationFn: ({
      slug,
      action,
      resolveConflicts,
    }: {
      slug: string
      action: Action
      resolveConflicts?: boolean
    }) => {
      const body = resolveConflicts ? { resolveConflicts: true } : undefined
      if (action === 'install') return api.post(`/modules/${slug}/install`, body)
      if (action === 'enable') return api.post(`/modules/${slug}/enable`, body)
      return api.post(`/modules/${slug}/disable`)
    },
    onSuccess: (_, { action, slug, resolveConflicts }) => {
      const labels: Record<Action, string> = {
        install: 'installed',
        enable: 'enabled',
        disable: 'disabled',
      }
      if (resolveConflicts) {
        toast({
          title: 'Mode switched',
          description: `Switched to "${slug}" — conflicting modules were disabled.`,
        })
      } else {
        toast({
          title: `Module ${labels[action]}`,
          description: `"${slug}" was ${labels[action]} successfully.`,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      queryClient.invalidateQueries({ queryKey: ['modules-enabled'] })
    },
    onError: (
      err: ApiError,
      variables: { slug: string; action: Action; resolveConflicts?: boolean }
    ) => {
      const data = err.response?.data
      if (
        data?.code === 'MODULE_CONFLICT' &&
        data.details?.conflicts &&
        data.details.conflicts.length > 0
      ) {
        const cachedModules = queryClient.getQueryData<Module[]>(['modules'])
        const mod = cachedModules?.find((m) => m.slug === variables.slug)
        setSwitchDialog({
          open: true,
          slug: variables.slug,
          moduleName: mod?.name ?? variables.slug,
          action: variables.action as 'install' | 'enable',
          conflicts: data.details.conflicts,
        })
        return
      }
      const msg = data?.message ?? err.message
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })

  const settingsMutation = useMutation({
    mutationFn: ({ slug, settings }: { slug: string; settings: Record<string, unknown> }) =>
      api.patch(`/modules/${slug}/settings`, { settings }),
    onSuccess: (_, { slug }) => {
      toast({ title: 'Settings saved', description: `"${slug}" settings updated.` })
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      setSettingsDialog((s) => ({ ...s, open: false }))
    },
    onError: (err: ApiError) => {
      const msg = err.response?.data?.message ?? err.message
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })

  function openSettings(mod: Module) {
    setSettingsDialog({
      open: true,
      slug: mod.slug,
      value: mod.settings ? JSON.stringify(mod.settings, null, 2) : '{}',
    })
  }

  function handleSettingsSave() {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(settingsDialog.value)
    } catch {
      toast({
        title: 'Invalid JSON',
        description: 'Fix the JSON syntax before saving.',
        variant: 'destructive',
      })
      return
    }
    settingsMutation.mutate({ slug: settingsDialog.slug, settings: parsed })
  }

  function handleActionClick(mod: Module, action: Action) {
    if (action !== 'disable' && mod.conflicts && mod.conflicts.length > 0) {
      setSwitchDialog({
        open: true,
        slug: mod.slug,
        moduleName: mod.name,
        action: action as 'install' | 'enable',
        conflicts: mod.conflicts,
      })
      return
    }
    setConfirm({ open: true, slug: mod.slug, action })
  }

  function closeConfirm() {
    setConfirm((s) => ({ ...s, open: false }))
  }

  function handleConfirm() {
    mutation.mutate({ slug: confirm.slug, action: confirm.action })
    closeConfirm()
  }

  function closeSwitchDialog() {
    setSwitchDialog((s) => ({ ...s, open: false }))
  }

  function handleSwitchConfirm() {
    mutation.mutate({
      slug: switchDialog.slug,
      action: switchDialog.action,
      resolveConflicts: true,
    })
    closeSwitchDialog()
  }

  const modules = useMemo(() => data ?? [], [data])

  /** Catalog-visible modules: hides internal-only deps unless showInternal is on. */
  const catalogModules = useMemo(
    () => modules.filter((mod) => showInternal || mod.visibleInCatalog !== false),
    [modules, showInternal]
  )

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: catalogModules.length,
      AVAILABLE: 0,
      INSTALLED: 0,
      ENABLED: 0,
      DISABLED: 0,
    }
    for (const mod of catalogModules) counts[mod.status] += 1
    return counts
  }, [catalogModules])

  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase()
    return catalogModules.filter((mod) => {
      if (statusFilter !== 'ALL' && mod.status !== statusFilter) return false
      if (!query) return true
      return (
        mod.name.toLowerCase().includes(query) ||
        mod.slug.toLowerCase().includes(query) ||
        (mod.description ?? '').toLowerCase().includes(query)
      )
    })
  }, [catalogModules, search, statusFilter])

  const filterChips: Array<{ key: StatusFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'ENABLED', label: 'Enabled' },
    { key: 'INSTALLED', label: 'Installed' },
    { key: 'AVAILABLE', label: 'Available' },
    { key: 'DISABLED', label: 'Disabled' },
  ]

  const confirmLabels: Record<Action, { title: string; description: string; btn: string }> = {
    install: {
      title: 'Install module',
      description: `Install "${confirm.slug}"? This will register its permissions and seed data.`,
      btn: 'Install',
    },
    enable: {
      title: 'Enable module',
      description: `Enable "${confirm.slug}"? Routes and nav items will become live immediately.`,
      btn: 'Enable',
    },
    disable: {
      title: 'Disable module',
      description: `Disable "${confirm.slug}"? All routes will return 404. Data is retained.`,
      btn: 'Disable',
    },
  }

  const cd = confirmLabels[confirm.action]

  return (
    <PermissionGuard permission="modules:view">
      <div>
        <PageHeader
          title="Modules"
          action={
            !isLoading && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <LayoutGrid className="h-4 w-4" />
                {statusCounts.ALL} {statusCounts.ALL === 1 ? 'module' : 'modules'}
              </span>
            )
          }
        />

        <div className="sticky top-0 z-10 -mx-6 flex flex-col gap-3 border-b bg-background/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search modules…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ '--th-input-pl': '2.25rem' } as CSSProperties}
              aria-label="Search modules"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  statusFilter === chip.key
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background text-muted-foreground hover:bg-muted'
                )}
              >
                {chip.label}
                <span className="ml-1 tabular-nums opacity-70">{statusCounts[chip.key]}</span>
              </button>
            ))}

            {/* Separator */}
            <span className="self-center border-l border-input h-4 mx-0.5" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setShowInternal((v) => !v)}
              aria-pressed={showInternal}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                showInternal
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background text-muted-foreground hover:bg-muted'
              )}
            >
              Show internal
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-5">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-md" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
                <Skeleton className="mt-4 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
                <Skeleton className="mt-4 h-8 w-24" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && filteredModules.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center text-muted-foreground">
            <Package className="h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium text-foreground">No modules match</p>
            <p className="text-sm">Try a different search term or clear the status filter.</p>
          </div>
        )}

        {!isLoading && filteredModules.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-4">
            {filteredModules.map((mod) => {
              const hasActiveConflicts = !!(mod.conflicts && mod.conflicts.length > 0)
              const isNotActive = mod.status !== 'ENABLED'
              return (
                <div
                  key={mod.slug}
                  className="flex h-full min-w-[280px] max-w-[420px] flex-1 basis-[340px] flex-col gap-3 rounded-lg border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <ModuleIcon icon={mod.icon} />
                      <div className="min-w-0">
                        <div className="flex items-start gap-1.5">
                          <span
                            className="font-medium leading-snug text-foreground"
                            title={mod.name}
                          >
                            {mod.name}
                          </span>
                          {mod.core && (
                            <Lock
                              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                              aria-label="Core module — cannot be disabled"
                            />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">v{mod.version}</p>
                      </div>
                    </div>
                    <StatusBadgeModule status={mod.status} />
                  </div>

                  <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">
                    {mod.description ?? '—'}
                  </p>

                  {hasActiveConflicts && isNotActive && (
                    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <AlertTriangle
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500"
                        aria-hidden="true"
                      />
                      <span>
                        {'Requires disabling: '}
                        {mod.conflicts!.map((c) => c.name).join(', ')}
                      </span>
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    {!mod.core && mod.status === 'AVAILABLE' && (
                      <Button size="sm" onClick={() => handleActionClick(mod, 'install')}>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Install
                      </Button>
                    )}
                    {!mod.core && mod.status === 'INSTALLED' && (
                      <Button size="sm" onClick={() => handleActionClick(mod, 'enable')}>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Enable
                      </Button>
                    )}
                    {!mod.core && mod.status === 'ENABLED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleActionClick(mod, 'disable')}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Disable
                      </Button>
                    )}
                    {!mod.core && mod.status === 'DISABLED' && (
                      <Button size="sm" onClick={() => handleActionClick(mod, 'enable')}>
                        <CheckCircle className="mr-1 h-4 w-4" />
                        Enable
                      </Button>
                    )}
                    {mod.status !== 'AVAILABLE' && (
                      <Button size="sm" variant="ghost" onClick={() => openSettings(mod)}>
                        <Settings className="mr-1 h-4 w-4" />
                        Settings
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <ConfirmDialog
          open={confirm.open}
          onClose={closeConfirm}
          onConfirm={handleConfirm}
          title={cd?.title ?? ''}
          description={cd?.description ?? ''}
          confirmLabel={cd?.btn ?? 'Confirm'}
          isLoading={mutation.isPending}
          variant={confirm.action === 'disable' ? 'destructive' : 'warning'}
        />

        <Dialog open={switchDialog.open} onOpenChange={(o) => !o && closeSwitchDialog()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Switch to {switchDialog.moduleName}?</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-sm text-muted-foreground">
              <p>
                The following {switchDialog.conflicts.length === 1 ? 'module' : 'modules'} will be
                disabled:
              </p>
              <ul className="list-disc space-y-1 pl-5">
                {switchDialog.conflicts.map((c) => (
                  <li key={c.slug} className="text-foreground">
                    {c.name}
                  </li>
                ))}
              </ul>
              <p>
                This is <strong className="text-foreground">non-destructive</strong> — no data is
                deleted. Disabling{' '}
                <strong className="text-foreground">{switchDialog.moduleName}</strong> later
                restores the other modules with their values intact.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={closeSwitchDialog} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSwitchConfirm} disabled={mutation.isPending}>
                {switchDialog.action === 'install' ? 'Install & switch' : 'Enable & switch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Modal
          open={settingsDialog.open}
          onClose={() => setSettingsDialog((s) => ({ ...s, open: false }))}
          title={`Settings — ${settingsDialog.slug}`}
          description="Edit module settings as JSON. Changes take effect immediately."
          size="md"
          footer={
            <>
              <Button
                variant="outline"
                onClick={() => setSettingsDialog((s) => ({ ...s, open: false }))}
              >
                Cancel
              </Button>
              <Button onClick={handleSettingsSave} disabled={settingsMutation.isPending}>
                {settingsMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </>
          }
        >
          <div className="space-y-2 py-2">
            <Label htmlFor="settings-json">Settings (JSON)</Label>
            <Textarea
              id="settings-json"
              rows={12}
              className="font-mono text-xs"
              value={settingsDialog.value}
              onChange={(e) => setSettingsDialog((s) => ({ ...s, value: e.target.value }))}
              spellCheck={false}
            />
          </div>
        </Modal>
      </div>
    </PermissionGuard>
  )
}
