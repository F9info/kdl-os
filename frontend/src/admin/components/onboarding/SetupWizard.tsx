'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { WebsiteDelivery } from '@/admin/lib/project-type'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { ImageUploadField } from '@/admin/components/shared/ImageUploadField'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ProductPicker,
  sameSet,
  withBase,
  type ModuleGraph,
} from '@/admin/components/products/ProductPicker'

type Step = 'identity' | 'products' | 'website' | 'done'

// The company details asked once, here. They are saved to Application Identity (Settings >
// Identity), the single place every module reads them from, and are never asked again. Colours are
// not asked: a website's palette is built from its logo (Color Palette), not typed in here.
const DETAIL_KEYS = [
  'app_name',
  'logo_light',
  'favicon',
  'contact_email',
  'contact_phone',
  'contact_address',
] as const
type DetailKey = (typeof DETAIL_KEYS)[number]
const EMPTY_DETAILS = Object.fromEntries(DETAIL_KEYS.map((k) => [k, ''])) as Record<
  DetailKey,
  string
>
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
  const [details, setDetails] = useState<Record<DetailKey, string>>(EMPTY_DETAILS)
  const setDetail = (key: DetailKey, value: string) => setDetails((d) => ({ ...d, [key]: value }))
  const [selected, setSelected] = useState<string[]>([])
  const [delivery, setDelivery] = useState<WebsiteDelivery | null>(null)
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
      setDetails(
        Object.fromEntries(DETAIL_KEYS.map((k) => [k, identity[k] ?? ''])) as Record<
          DetailKey,
          string
        >
      )
      setSelected(stored.selected)
      setDelivery(stored.delivery ?? null)
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
    mutationFn: () =>
      api.put('/identity', Object.fromEntries(DETAIL_KEYS.map((k) => [k, details[k].trim()]))),
    onSuccess: () => setStep('products'),
  })
  const saveProducts = useMutation({
    mutationFn: async () => {
      // A Website with no delivery chosen yet starts as a web application (the usual case).
      const chosen = selected.includes('website') ? (delivery ?? 'web-app') : null
      if (
        stored &&
        (!sameSet(withBase(selected), stored.selected) || (chosen && chosen !== stored.delivery))
      )
        await api.put('/modules/products', {
          products: withBase(selected),
          ...(chosen ? { delivery: chosen } : {}),
        })
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
          <div className="max-h-[80vh] space-y-4 overflow-y-auto pr-1">
            <DialogHeader>
              <DialogTitle>Welcome. Tell us about your company</DialogTitle>
              <DialogDescription>
                Step 1 of 2. You enter this once. It is used across the admin, your website and
                every module you install. Change it any time in Settings &gt; Identity.
              </DialogDescription>
            </DialogHeader>
            <ErrorAlert error={error} />
            <FormField label="Company name">
              <Input
                value={details.app_name}
                onChange={(e) => setDetail('app_name', e.target.value)}
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Logo" hint="PNG, JPEG, WebP or SVG.">
                <ImageUploadField
                  name="logo_light"
                  value={details.logo_light}
                  onChange={(v) => setDetail('logo_light', v)}
                  emptyText="No logo yet"
                  setText="Logo set"
                />
              </FormField>
              <FormField label="Favicon" hint="Small square image.">
                <ImageUploadField
                  name="favicon"
                  value={details.favicon}
                  onChange={(v) => setDetail('favicon', v)}
                  emptyText="No favicon yet"
                  setText="Favicon set"
                />
              </FormField>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Email">
                <Input
                  type="email"
                  value={details.contact_email}
                  onChange={(e) => setDetail('contact_email', e.target.value)}
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={details.contact_phone}
                  onChange={(e) => setDetail('contact_phone', e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Address">
              <Input
                value={details.contact_address}
                onChange={(e) => setDetail('contact_address', e.target.value)}
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
          </div>
        )}

        {step === 'products' && (
          <>
            <DialogHeader>
              <DialogTitle>What are you building?</DialogTitle>
              <DialogDescription>
                Step 2 of 2. Each product turns on the modules it needs.
              </DialogDescription>
            </DialogHeader>
            <ErrorAlert error={error} />
            <ProductPicker
              products={stored?.products ?? []}
              selected={selected}
              onToggle={toggle}
              resolution={r}
              nameOf={nameOf}
              delivery={delivery ?? (selected.includes('website') ? 'web-app' : null)}
              onDeliveryChange={setDelivery}
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
