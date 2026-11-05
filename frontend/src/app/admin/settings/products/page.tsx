'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { toast } from '@/hooks/use-toast'
import { usePermissions } from '@/hooks/usePermissions'
import { PageHeader } from '@/components/layout/PageHeader'
import { PermissionGuard } from '@/components/shared/PermissionGuard'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { SetupWizard } from '@/components/onboarding/SetupWizard'
import {
  ProductPicker,
  sameSet,
  type ModuleGraph as Graph,
} from '@/components/products/ProductPicker'

export default function ProductsPage() {
  const { can } = usePermissions()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)
  const initialized = useRef(false)

  // Stored selection + product list.
  const {
    data: stored,
    isLoading,
    error: loadError,
  } = useQuery({
    queryKey: ['module-graph', 'stored'],
    queryFn: () => api.get('/modules/graph').then((r) => r.data.data as Graph),
  })

  useEffect(() => {
    if (stored && !initialized.current) {
      setSelected(stored.selected)
      initialized.current = true
    }
  }, [stored])

  // Live preview of what the current selection would do.
  const { data: preview, error: previewError } = useQuery({
    queryKey: ['module-graph', 'preview', [...selected].sort().join(',')],
    enabled: initialized.current,
    queryFn: () =>
      api
        .get('/modules/graph', { params: { products: selected.join(',') } })
        .then((r) => r.data.data as Graph),
  })

  const nameOf = (slug: string) => stored?.modules.find((m) => m.slug === slug)?.name ?? slug

  const applyMutation = useMutation({
    mutationFn: () =>
      api.put('/modules/products', { products: selected }).then((r) => r.data.data as Graph),
    onSuccess: (saved) => {
      queryClient.setQueryData(['module-graph', 'stored'], saved)
      queryClient.invalidateQueries({ queryKey: ['module-graph'] })
      queryClient.invalidateQueries({ queryKey: ['modules-enabled'] })
      setSelected(saved.selected)
      setConfirming(false)
      toast({ title: 'Products updated' })
    },
    onError: () => setConfirming(false),
  })

  function toggle(key: string) {
    setConfirming(false)
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))
  }

  const r = preview?.resolution
  const dirty = stored ? !sameSet(selected, stored.selected) : false
  const canApply = can('modules:edit') && can('modules:add') && dirty && r?.valid

  return (
    <PermissionGuard permission="modules:view">
      <div className="max-w-3xl">
        <PageHeader title="Products" />
        {can('modules:add') && can('settings:edit') && can('projects:update') && (
          <div className="mb-4">
            <Button variant="outline" onClick={() => setWizardOpen(true)}>
              Run setup wizard
            </Button>
            <SetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
          </div>
        )}
        <p className="mb-6 text-sm text-muted-foreground">
          Choose what you are building. Each product turns on the modules it needs. Turning a
          product off never removes data or switches modules off.
        </p>

        {isLoading ? (
          <LoadingSpinner />
        ) : loadError ? (
          <ErrorAlert error={loadError} />
        ) : (
          <div className="space-y-6">
            <ErrorAlert error={applyMutation.error ?? previewError} />

            <ProductPicker
              products={stored?.products ?? []}
              selected={selected}
              onToggle={toggle}
              disabled={!can('modules:edit')}
              resolution={r}
              nameOf={nameOf}
            />

            {can('modules:edit') && (
              <div className="flex items-center justify-end gap-2">
                {confirming ? (
                  <>
                    <span className="text-sm">Apply these products?</span>
                    <Button variant="outline" onClick={() => setConfirming(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => applyMutation.mutate()}
                      disabled={applyMutation.isPending}
                    >
                      {applyMutation.isPending ? 'Applying…' : 'Confirm'}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setConfirming(true)} disabled={!canApply}>
                    Apply products
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
