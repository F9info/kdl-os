'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImagePlus, Loader2, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { AppTypeCards, ModulePreview, type AppTypeInfo } from './AppTypeCards'
import {
  installApi,
  resumeStep,
  type InstallState,
  type LaunchResult,
  type ModuleChoices,
} from './install-api'
import { ModulesStep } from './ModulesStep'
import { CompleteScreen } from './CompleteScreen'
import { SetupTokenGate } from './SetupTokenGate'
import { DatabaseStep } from './DatabaseStep'
import { AdminStep } from './AdminStep'
import { CoreStep } from './CoreStep'

const MAX_LOGO = 2 * 1024 * 1024
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const STEPS = [
  'Database',
  'Company',
  'Admin',
  'Core install',
  'Application type',
  'Modules',
  'Launch',
]
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mb-6 flex items-center justify-center gap-2 text-sm" aria-label="Progress">
      {STEPS.map((label, i) => {
        const n = i + 1
        const done = n < step
        return (
          <li
            key={label}
            className="flex items-center gap-2"
            aria-current={n === step ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                n === step && 'border-primary bg-primary text-primary-foreground',
                done && 'border-primary text-primary'
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </span>
            <span
              className={cn(
                'hidden sm:inline',
                n === step ? 'font-medium' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
            {n < STEPS.length && <span className="mx-1 h-px w-6 bg-border sm:w-10" />}
          </li>
        )
      })}
    </ol>
  )
}

export function InstallWizard() {
  const router = useRouter()
  const qc = useQueryClient()
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [logoPath, setLogoPath] = useState('')
  const [logoPreview, setLogoPreview] = useState('')
  const [logoError, setLogoError] = useState('')
  const [touched, setTouched] = useState(false)
  const [appType, setAppType] = useState<string | null>(null)
  const [launched, setLaunched] = useState<LaunchResult | null>(null)
  const seeded = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: state, isLoading } = useQuery({
    queryKey: ['install', 'status'],
    queryFn: () => installApi.get('/status').then((r) => r.data.data as InstallState),
    retry: false,
    staleTime: 0,
  })
  const { data: types } = useQuery({
    queryKey: ['install', 'types'],
    enabled: !!state && !state.installed && !!state.token_ok,
    queryFn: () => installApi.get('/app-types').then((r) => r.data.data as AppTypeInfo[]),
  })

  const { data: picks } = useQuery({
    queryKey: ['install', 'modules'],
    enabled: !!state && !state.installed && !!state.token_ok && step === 7,
    queryFn: () => installApi.get('/modules').then((r) => r.data.data as ModuleChoices),
  })

  // Installed: nothing to do here. Not installed: pick up where a refresh left off.
  useEffect(() => {
    if (!state) return
    if (state.installed) {
      if (!launched) router.replace('/login') // just launched: the completion screen sends them on
      return
    }
    if (state.token_required && !state.token_ok) return // the token screen is showing
    if (seeded.current) return
    seeded.current = true
    const c = state.company
    if (c) {
      setName(c.name)
      setPhone(c.phone)
      setEmail(c.email)
      setLogoPath(c.logo_path)
      setLogoPreview(c.logo_url)
    }
    setAppType(state.app_type ?? null)
    setStep(resumeStep(state))
  }, [state, router, launched])

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      return (await installApi.post('/logo', fd)).data.data as { path: string; url: string }
    },
    onSuccess: (r) => {
      setLogoPath(r.path)
      setLogoError('')
    },
  })

  const pickLogo = (file?: File) => {
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) return setLogoError('Use a PNG, JPEG or WebP image.')
    if (file.size > MAX_LOGO) return setLogoError('The logo must be 2 MB or smaller.')
    setLogoError('')
    setLogoPreview(URL.createObjectURL(file))
    upload.mutate(file)
  }

  const errors = {
    logo: !logoPath ? 'Add your company logo.' : '',
    name: !name.trim() ? 'Enter your company name.' : '',
    email: email.trim() && !EMAIL.test(email.trim()) ? 'Enter a valid email address.' : '',
  }
  const step1Ok = !errors.logo && !errors.name && !errors.email && !upload.isPending

  const saveCompany = useMutation({
    mutationFn: () =>
      installApi.put('/company', {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        logo_path: logoPath,
      }),
    onSuccess: () => setStep(3),
  })
  const saveType = useMutation({
    mutationFn: () => installApi.put('/app-type', { app_type: appType }),
    onSuccess: () => setStep(6),
  })
  // Installing modules runs their migrations and seeders, which can take a while.
  const launch = useMutation({
    mutationFn: () =>
      installApi
        .post('/complete', undefined, { timeout: 300_000 })
        .then((r) => r.data.data as LaunchResult),
    // Show what was set up before sending the admin to sign in.
    onSuccess: (result) => setLaunched(result),
  })

  if (isLoading || !state || (state.installed && !launched)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  const needsToken = !!state.token_required && !state.token_ok
  const type = types?.find((t) => t.key === appType)
  const next1 = () => {
    setTouched(true)
    if (step1Ok) saveCompany.mutate()
  }

  return (
    <main className="min-h-screen bg-muted/40 px-4 py-8 sm:py-12">
      <div className="mx-auto w-full max-w-3xl">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold tracking-tight">KDL OS</p>
          <p className="text-sm text-muted-foreground">Let&apos;s set up your workspace</p>
        </div>
        {!needsToken && <Stepper step={step} />}

        <div className="rounded-xl border bg-card p-5 shadow-md sm:p-8">
          {needsToken && (
            <SetupTokenGate
              onAccepted={() => {
                seeded.current = false
                qc.invalidateQueries({ queryKey: ['install'] })
              }}
            />
          )}

          {launched && (
            <CompleteScreen result={launched} onContinue={() => router.replace('/login')} />
          )}

          {!launched && !needsToken && (
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step {step} of {STEPS.length}
            </p>
          )}

          {!launched && !needsToken && step === 1 && <DatabaseStep onNext={() => setStep(2)} />}

          {!launched && !needsToken && step === 3 && (
            <AdminStep initial={state.admin} onBack={() => setStep(2)} onNext={() => setStep(4)} />
          )}

          {!launched && !needsToken && step === 4 && (
            <CoreStep core={state.core} onBack={() => setStep(3)} onNext={() => setStep(5)} />
          )}

          {!launched && !needsToken && step === 2 && (
            <section>
              <h1 className="text-xl font-semibold">Tell us about your company</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                Your logo and name appear on the sign-in page, the admin and your website. You can
                change them any time.
              </p>
              <div className="space-y-5">
                <FormField
                  label="Company logo"
                  required
                  error={logoError || (touched && errors.logo) || undefined}
                  hint="PNG, JPEG or WebP, up to 2 MB."
                >
                  <div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept={LOGO_TYPES.join(',')}
                      className="sr-only"
                      aria-label="Company logo file"
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                    />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex h-32 w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed bg-muted/30 text-sm text-muted-foreground transition hover:border-primary/60"
                    >
                      {logoPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="max-h-28 max-w-[80%] object-contain"
                        />
                      ) : (
                        <span className="flex items-center gap-2">
                          <ImagePlus className="h-5 w-5" /> Click to upload your logo
                        </span>
                      )}
                    </button>
                    {upload.isPending && (
                      <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>
                    )}
                    {upload.error && <ErrorAlert error={upload.error} className="mt-2" />}
                    {logoPreview && (
                      <button
                        type="button"
                        className="mt-1 text-xs text-primary underline"
                        onClick={() => fileRef.current?.click()}
                      >
                        Replace logo
                      </button>
                    )}
                  </div>
                </FormField>
                <FormField label="Company name" required error={touched ? errors.name : undefined}>
                  <Input
                    value={name}
                    maxLength={100}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ABC Technologies"
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Phone number (optional)">
                    <Input
                      value={phone}
                      maxLength={30}
                      inputMode="tel"
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </FormField>
                  <FormField
                    label="Email address (optional)"
                    error={touched ? errors.email : undefined}
                  >
                    <Input
                      value={email}
                      maxLength={150}
                      type="email"
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                </div>
                {saveCompany.error && <ErrorAlert error={saveCompany.error} />}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={saveCompany.isPending}>
                  Back
                </Button>
                <Button onClick={next1} disabled={saveCompany.isPending || upload.isPending}>
                  {saveCompany.isPending ? 'Saving…' : 'Next'}
                </Button>
              </div>
            </section>
          )}

          {!launched && !needsToken && step === 5 && (
            <section>
              <h1 className="text-xl font-semibold">What do you want to create?</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                This only sets your starting point. You can change it later in Settings.
              </p>
              {!types ? (
                <LoadingSpinner />
              ) : (
                <div className="space-y-4">
                  <AppTypeCards types={types} value={appType} onChange={setAppType} />
                  {type && <ModulePreview type={type} />}
                </div>
              )}
              {saveType.error && <ErrorAlert error={saveType.error} className="mt-4" />}
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(4)}>
                  Back
                </Button>
                <Button onClick={() => saveType.mutate()} disabled={!appType || saveType.isPending}>
                  {saveType.isPending ? 'Saving…' : 'Next'}
                </Button>
              </div>
            </section>
          )}

          {!launched && !needsToken && step === 6 && (
            <ModulesStep onBack={() => setStep(5)} onNext={() => setStep(7)} />
          )}

          {!launched && !needsToken && step === 7 && (
            <section>
              <h1 className="text-xl font-semibold">Ready to launch</h1>
              <p className="mb-6 mt-1 text-sm text-muted-foreground">
                Check the summary, then launch. You will sign in on the next screen.
              </p>
              <div className="space-y-4 text-sm">
                <div className="flex items-center gap-4 rounded-lg border p-4">
                  {logoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoPreview} alt="" className="h-14 w-14 rounded object-contain" />
                  )}
                  <div>
                    <p className="font-semibold">{name}</p>
                    {phone && <p className="text-muted-foreground">{phone}</p>}
                    {email && <p className="text-muted-foreground">{email}</p>}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="font-medium">Application type: {type?.name ?? appType}</p>
                  <p className="mt-2 text-muted-foreground">Always included</p>
                  <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                    {(picks?.core.map((m) => m.name) ?? []).map((c) => (
                      <li key={c} className="flex items-center gap-2">
                        <Check className="h-3.5 w-3.5 text-primary" /> {c}
                      </li>
                    ))}
                  </ul>
                  {type && type.modules.length > 0 && (
                    <>
                      <p className="mt-3 text-muted-foreground">Added for you</p>
                      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                        {type.modules.map((m) => (
                          <li key={m.slug} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-primary" /> {m.name}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {picks && picks.selected.length > 0 && (
                    <>
                      <p className="mt-3 text-muted-foreground">Extra modules you chose</p>
                      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                        {picks.selected.map((slug) => (
                          <li key={slug} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-primary" />{' '}
                            {picks.optional.find((m) => m.slug === slug)?.name ?? slug}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {picks?.demo.available && (
                    <>
                      <p className="mt-3 text-muted-foreground">Your website</p>
                      <ul className="mt-1 space-y-1">
                        {(picks.demo.value
                          ? [
                              'A demo website',
                              'Four landing pages',
                              'Page and section builder ready',
                            ]
                          : ['Empty website: no sample content', 'Page and section builder ready']
                        ).map((t) => (
                          <li key={t} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-primary" /> {t}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {launch.error && <ErrorAlert error={launch.error} />}
                {state.status === 'running' && !launch.isPending && (
                  <p className="text-muted-foreground">
                    A launch was already in progress. Press Launch to continue; nothing is
                    duplicated.
                  </p>
                )}
              </div>
              <div className="mt-8 flex justify-between">
                <Button variant="ghost" onClick={() => setStep(6)} disabled={launch.isPending}>
                  Back
                </Button>
                <Button onClick={() => launch.mutate()} disabled={launch.isPending}>
                  {launch.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Setting things up…
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-2 h-4 w-4" /> Launch KDL OS
                    </>
                  )}
                </Button>
              </div>
              {launch.isPending && (
                <p className="mt-3 text-center text-xs text-muted-foreground" role="status">
                  This can take a minute. Please keep this page open.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </main>
  )
}
