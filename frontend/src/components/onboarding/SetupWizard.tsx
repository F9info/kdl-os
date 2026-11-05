'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductPicker, sameSet, type ModuleGraph } from '@/components/products/ProductPicker'

type Step = 'identity' | 'products' | 'website' | 'done'
type SiteResult = { choice: 'yes' | 'no'; created: string[]; skipped: string[] }

interface SetupWizardProps {
  open: boolean
  // Closes without finishing ("Ask me later" / Escape / the X).
  onClose: () => void
}

// Conditional setup: Identity is always first; the website step only appears when the Website
// product is chosen. Landing has no setup step yet (the landing module does not exist).
export function SetupWizard({ open, onClose }: SetupWizardProps) {
  const qc = useQueryClient()
  const [step, setStep] = useState<Step>('identity')
  const [name, setName] = useState('')
  const [color, setColor] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [site, setSite] = useState<SiteResult | null>(null)
  const seeded = useRef(false)

  const { data: identity } = useQuery({
    queryKey: ['identity'],
    enabled: open,
    queryFn: () => api.get('/identity').then((r) => r.data.data.identity as Record<string, string>),
  })
  const { data: stored } = useQuery({
    queryKey: ['module-graph', 'stored'],
    enabled: open,
    queryFn: () => api.get('/modules/graph').then((r) => r.data.data as ModuleGraph),
  })

  useEffect(() => {
    if (open && identity && stored && !seeded.current) {
      setName(identity.app_name ?? '')
      setColor(identity.brand_primary ?? '')
      setSelected(stored.selected)
      seeded.current = true
    }
  }, [open, identity, stored])

  const { data: preview } = useQuery({
    queryKey: ['module-graph', 'preview', [...selected].sort().join(',')],
    enabled: open && step === 'products' && seeded.current,
    queryFn: () =>
      api
        .get('/modules/graph', { params: { products: selected.join(',') } })
        .then((r) => r.data.data as ModuleGraph),
  })
  const nameOf = (slug: string) => stored?.modules.find((m) => m.slug === slug)?.name ?? slug

  const finish = (result: SiteResult) => {
    for (const key of [
      'onboarding',
      'modules-enabled',
      'module-graph',
      'app-config',
      'identity',
      'page-builder',
    ])
      qc.invalidateQueries({ queryKey: [key] })
    setSite(result)
    setStep('done')
  }

  const saveIdentity = useMutation({
    mutationFn: () => api.put('/identity', { app_name: name.trim(), brand_primary: color.trim() }),
    onSuccess: () => setStep('products'),
  })
  const saveProducts = useMutation({
    mutationFn: async () => {
      if (stored && !sameSet(selected, stored.selected))
        await api.put('/modules/products', { products: selected })
      // Only the Website product has a setup step; otherwise record "no website" so this stops asking.
      if (!selected.includes('website')) {
        return (await api.post('/projects/onboarding', { frontend: 'no' })).data.data as SiteResult
      }
      return null
    },
    onSuccess: (r) => (r ? finish(r) : setStep('website')),
  })
  const answerSite = useMutation({
    mutationFn: async (frontend: 'yes' | 'no') =>
      (await api.post('/projects/onboarding', { frontend })).data.data as SiteResult,
    onSuccess: finish,
  })

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const r = preview?.resolution
  const busy = saveIdentity.isPending || saveProducts.isPending || answerSite.isPending
  const error = saveIdentity.error ?? saveProducts.error ?? answerSite.error
  const ready = seeded.current

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl" data-testid="setup-wizard">
        {step === 'identity' && (
          <>
            <DialogHeader>
              <DialogTitle>Welcome. Name your application</DialogTitle>
              <DialogDescription>
                Step 1 of 2. This name and colour are used across the admin and your site. Add logos
                later in Settings &gt; Identity.
              </DialogDescription>
            </DialogHeader>
            <ErrorAlert error={error} />
            <FormField label="Application name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
            <FormField label="Primary brand colour" hint="Hex, for example #1a2b3c. Optional.">
              <Input
                value={color}
                placeholder="#1a2b3c"
                onChange={(e) => setColor(e.target.value)}
              />
            </FormField>
            <DialogFooter>
              <Button variant="ghost" onClick={onClose} disabled={busy}>
                Ask me later
              </Button>
              <Button onClick={() => saveIdentity.mutate()} disabled={busy || !ready}>
                {saveIdentity.isPending ? 'Saving…' : 'Next'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'products' && (
          <>
            <DialogHeader>
              <DialogTitle>What are you building?</DialogTitle>
              <DialogDescription>
                Step 2 of 2. Each product turns on the modules it needs. You can change this any
                time in Settings &gt; Products.
              </DialogDescription>
            </DialogHeader>
            <ErrorAlert error={error} />
            <ProductPicker
              products={stored?.products ?? []}
              selected={selected}
              onToggle={toggle}
              resolution={r}
              nameOf={nameOf}
            />
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('identity')} disabled={busy}>
                Back
              </Button>
              <Button onClick={() => saveProducts.mutate()} disabled={busy || r?.valid === false}>
                {saveProducts.isPending ? 'Applying…' : 'Next'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'website' && (
          <>
            <DialogHeader>
              <DialogTitle>Create a starter website?</DialogTitle>
              <DialogDescription>
                KDL OS can create a ready 5-page website (Home, About, Services, Contact, FAQ) that
                you can edit. Choose Skip to start with no pages.
              </DialogDescription>
            </DialogHeader>
            <ErrorAlert error={error} />
            <DialogFooter>
              <Button variant="outline" onClick={() => answerSite.mutate('no')} disabled={busy}>
                Skip
              </Button>
              <Button onClick={() => answerSite.mutate('yes')} disabled={busy}>
                {answerSite.isPending ? 'Creating your website…' : 'Yes, create my website'}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'done' && (
          <>
            <DialogHeader>
              <DialogTitle>You are set up</DialogTitle>
              <DialogDescription>
                {site && site.created.length > 0
                  ? `${site.created.length} page${site.created.length === 1 ? '' : 's'} created. Edit them in Page Builder and Themes.`
                  : 'Your products are saved. Change anything later in Settings.'}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              {site && site.created.length > 0 && (
                <Button variant="outline" asChild>
                  <Link href="/admin/page-builder" onClick={onClose}>
                    Open Page Builder
                  </Link>
                </Button>
              )}
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
