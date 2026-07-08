'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Lock, CheckCircle, XCircle, Settings } from 'lucide-react'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Modal } from '@/components/shared/Modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import type { Module, ModuleStatus } from '@/types/models.types'

function StatusBadgeModule({ status }: { status: ModuleStatus }) {
  const map: Record<ModuleStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    AVAILABLE: { label: 'Available', variant: 'outline' },
    INSTALLED: { label: 'Installed', variant: 'secondary' },
    ENABLED: { label: 'Enabled', variant: 'default' },
    DISABLED: { label: 'Disabled', variant: 'destructive' },
  }
  const { label, variant } = map[status] ?? { label: status, variant: 'outline' }
  return <Badge variant={variant}>{label}</Badge>
}

type Action = 'install' | 'enable' | 'disable'

interface ConfirmState {
  open: boolean
  slug: string
  action: Action
}

interface SettingsState {
  open: boolean
  slug: string
  value: string
}

export default function ModulesPage() {
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, slug: '', action: 'enable' })
  const [settingsDialog, setSettingsDialog] = useState<SettingsState>({ open: false, slug: '', value: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['modules'],
    queryFn: () => api.get('/modules').then((r) => r.data.data.modules as Module[]),
    staleTime: 30 * 1000,
  })

  const mutation = useMutation({
    mutationFn: ({ slug, action }: { slug: string; action: Action }) => {
      if (action === 'install') return api.post(`/modules/${slug}/install`)
      if (action === 'enable') return api.post(`/modules/${slug}/enable`)
      return api.post(`/modules/${slug}/disable`)
    },
    onSuccess: (_, { action, slug }) => {
      const labels: Record<Action, string> = {
        install: 'installed',
        enable: 'enabled',
        disable: 'disabled',
      }
      toast({ title: `Module ${labels[action]}`, description: `"${slug}" was ${labels[action]} successfully.` })
      queryClient.invalidateQueries({ queryKey: ['modules'] })
      queryClient.invalidateQueries({ queryKey: ['modules-enabled'] })
    },
    onError: (err: { response?: { data?: { message?: string } }; message: string }) => {
      const msg = err.response?.data?.message ?? err.message
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
    onError: (err: { response?: { data?: { message?: string } }; message: string }) => {
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
      toast({ title: 'Invalid JSON', description: 'Fix the JSON syntax before saving.', variant: 'destructive' })
      return
    }
    settingsMutation.mutate({ slug: settingsDialog.slug, settings: parsed })
  }

  function openConfirm(slug: string, action: Action) {
    setConfirm({ open: true, slug, action })
  }

  function closeConfirm() {
    setConfirm((s) => ({ ...s, open: false }))
  }

  function handleConfirm() {
    mutation.mutate({ slug: confirm.slug, action: confirm.action })
    closeConfirm()
  }

  const modules = data ?? []

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
      <div className="p-6">
        <PageHeader title="Modules" />

        {isLoading && (
          <div className="mt-8 text-center text-gray-500">Loading modules…</div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <div
              key={mod.slug}
              className="rounded-lg border bg-white p-5 shadow-sm flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-gray-400 shrink-0" />
                  <span className="font-medium text-gray-900">{mod.name}</span>
                  {mod.core && (
                    <Lock className="h-4 w-4 text-gray-400 shrink-0" aria-label="Core module — cannot be disabled" />
                  )}
                </div>
                <StatusBadgeModule status={mod.status} />
              </div>

              {mod.description && (
                <p className="text-sm text-gray-500">{mod.description}</p>
              )}

              <p className="text-xs text-gray-400">v{mod.version}</p>

              <div className="flex flex-wrap gap-2 pt-1">
                  {!mod.core && mod.status === 'AVAILABLE' && (
                    <Button size="sm" onClick={() => openConfirm(mod.slug, 'install')}>
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Install
                    </Button>
                  )}
                  {!mod.core && mod.status === 'INSTALLED' && (
                    <Button size="sm" onClick={() => openConfirm(mod.slug, 'enable')}>
                      <CheckCircle className="mr-1 h-4 w-4" />
                      Enable
                    </Button>
                  )}
                  {!mod.core && mod.status === 'ENABLED' && (
                    <Button size="sm" variant="outline" onClick={() => openConfirm(mod.slug, 'disable')}>
                      <XCircle className="mr-1 h-4 w-4" />
                      Disable
                    </Button>
                  )}
                  {!mod.core && mod.status === 'DISABLED' && (
                    <Button size="sm" onClick={() => openConfirm(mod.slug, 'enable')}>
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
          ))}
        </div>

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

        <Modal
          open={settingsDialog.open}
          onClose={() => setSettingsDialog((s) => ({ ...s, open: false }))}
          title={`Settings — ${settingsDialog.slug}`}
          description="Edit module settings as JSON. Changes take effect immediately."
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={() => setSettingsDialog((s) => ({ ...s, open: false }))}>
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
