'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Building2, Check, Plus, Trash2, User as UserIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/models.types'
import { post, useJoinForm, usePlans } from './api'
import { AuthDivider, AuthError, outlineBtn, primaryBtn, SocialButtons } from './AuthShell'
import { errorText, validNational } from './AuthApi'
import { FieldInput, missingRequired } from './FieldInput'
import { priceFor } from './format'
import { getJoinAccount, setJoinAccount, type JoinAccount } from './JoinState'
import { cardCls, Crumbs, MiniSummary, OrderSummary, payLabel, Stepper } from './JoinUi'
import type { FieldGroup, Interval, MemberType } from './types'

interface SignupResult {
  next: 'checkout' | 'active' | 'approval'
  user?: User
  accessToken?: string
}
interface ContactDraft {
  name: string
  email: string
  access: 'FULL' | 'CONTENT' | 'BILLING'
}

const TYPE_INFO: Record<
  MemberType,
  { title: string; hint: string; icon: typeof UserIcon; points: string[]; badge?: string }
> = {
  INDIVIDUAL: {
    title: 'Individual',
    hint: 'For yourself — one person, one login.',
    icon: UserIcon,
    points: [
      'A few professional details',
      'Member card in your name',
      'GST invoice to you (optional GSTIN)',
    ],
  },
  ORGANISATION: {
    title: 'Organisation',
    hint: 'For a company, firm, college or institution.',
    icon: Building2,
    badge: 'For businesses',
    points: [
      'Business details and GSTIN',
      'Several people under one membership',
      'GST invoice to the company — claim input credit',
    ],
  },
}
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/
const isDocs = (g: FieldGroup) => /doc/i.test(`${g.key} ${g.name}`)
const emailOk = (v: string) => z.string().email().safeParse(v).success

export function JoinFlow({ planSlug, interval: wanted }: { planSlug: string; interval?: string }) {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { data: plans, isLoading } = usePlans()
  const plan = plans?.find((p) => p.slug === planSlug)
  const [account, setAccount] = useState<JoinAccount | null | undefined>(undefined)
  const [type, setType] = useState<MemberType | null>(null)
  const [step, setStep] = useState<'details' | 'docs' | 'contacts' | 'pay'>('details')
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [email, setEmail] = useState('')
  const [legalName, setLegalName] = useState('')
  const [gstin, setGstin] = useState('')
  const [contacts, setContacts] = useState<ContactDraft[]>([])
  const [draft, setDraft] = useState<ContactDraft>({ name: '', email: '', access: 'CONTENT' })
  const [terms, setTerms] = useState(false)
  const [formError, setFormError] = useState<string>()
  const { data: groups = [] } = useJoinForm(planSlug, type ?? undefined)

  // The account step keeps its data in memory; read it after mount (never during SSR).
  useEffect(() => setAccount(getJoinAccount()), [])

  const interval = (
    plan?.prices.some((p) => p.interval === wanted) ? wanted : plan?.prices[0]?.interval
  ) as Interval | undefined
  const org = type === 'ORGANISATION'
  const docGroups = org ? groups.filter(isDocs) : []
  const detailGroups = groups.filter((g) => !docGroups.includes(g))
  const maxContacts = Math.max(plan?.max_contacts ?? 1, 1)
  const steps = org
    ? [
        'Account',
        'Joining as',
        'Business',
        ...(docGroups.length ? ['Documents'] : []),
        ...(maxContacts > 1 ? ['Contacts'] : []),
        'Pay',
      ]
    : ['Account', 'Joining as', 'Details', 'Pay']
  const order = ['details', 'docs', 'contacts', 'pay'] as const
  const visible = order.filter(
    (s) =>
      s === 'details' ||
      s === 'pay' ||
      (s === 'docs' ? docGroups.length > 0 : org && maxContacts > 1)
  )
  const next = () => setStep(visible[visible.indexOf(step) + 1] ?? 'pay')
  const back = () =>
    visible.indexOf(step) > 0 ? setStep(visible[visible.indexOf(step) - 1]!) : setType(null)
  const current = type ? 2 + visible.indexOf(step) : 1

  const signup = useMutation({
    mutationFn: async () => {
      const a = account!
      const res = await post<SignupResult>('/membership/signup', {
        plan_slug: planSlug,
        interval,
        member_type: type,
        full_name: a.full_name,
        email: a.email || email,
        mobile: a.mobile,
        password: a.password,
        verification_token: a.verification_token,
        legal_name: legalName || undefined,
        gstin: gstin || undefined,
        fields: values,
      })
      if (res.user && res.accessToken) setAuth(res.user, res.accessToken)
      // Extra people are added once the account exists; a failure here must not lose the signup.
      for (const c of contacts)
        await post('/membership/me/contacts', {
          name: c.name,
          email: c.email,
          access: c.access,
        }).catch(() => null)
      return res
    },
    onSuccess: (res) => {
      setJoinAccount(null)
      router.push(
        res.next === 'checkout'
          ? `/membership/checkout?plan=${planSlug}&interval=${interval ?? ''}`
          : `/membership/success?state=${plan?.is_free ? 'free' : res.next}`
      )
    },
  })

  if (isLoading || account === undefined) return <LoadingSpinner />
  if (!plan) return <ErrorAlert error={new Error('This plan is not available.')} />
  if (!account) {
    return plan.is_free ? (
      <FreeJoin planSlug={planSlug} />
    ) : (
      <RestartAccount planSlug={planSlug} interval={interval} />
    )
  }
  const price = interval ? priceFor(plan, interval) : undefined
  const types = plan.member_types?.length
    ? plan.member_types
    : (['INDIVIDUAL', 'ORGANISATION'] as MemberType[])
  const who = org
    ? `Organisation · ${legalName || account.full_name}`
    : `Individual · ${account.full_name ?? ''}`

  const validateDetails = () => {
    const missing = missingRequired(step === 'docs' ? docGroups : detailGroups, values)
    if (step === 'details' && !account.email && !emailOk(email))
      missing.email = 'Enter a valid email'
    if (step === 'details' && org && legalName.trim().length < 2)
      missing.legal_name = 'Enter the organisation name'
    if (step === 'details' && gstin && !GSTIN.test(gstin.toUpperCase()))
      missing.gstin = 'Enter a valid GSTIN'
    setErrors(missing)
    if (!Object.keys(missing).length) next()
  }
  const addContact = () => {
    if (draft.name.trim().length < 2 || !emailOk(draft.email))
      return setFormError('Enter the name and a valid email')
    setFormError(undefined)
    setContacts((c) => [...c, { ...draft, name: draft.name.trim() }])
    setDraft({ name: '', email: '', access: 'CONTENT' })
  }
  const pay = () => {
    if (!terms) return setFormError('Please accept the membership terms')
    setFormError(undefined)
    signup.mutate()
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 py-2">
      <Crumbs
        plan={plan.name}
        current={!type ? 'Joining as' : step === 'pay' ? 'Review and pay' : 'Your details'}
      />
      <h1 className="text-4xl font-extrabold tracking-tight">
        {!type
          ? 'How are you joining?'
          : step === 'pay'
            ? 'Review and pay'
            : step === 'docs'
              ? 'Documents'
              : step === 'contacts'
                ? 'Add your team'
                : org
                  ? 'Business details'
                  : 'Professional details'}
      </h1>
      <Stepper steps={steps} current={current} />

      {!type && (
        <>
          <div className="grid max-w-4xl gap-5 sm:grid-cols-2">
            {types.map((t) => {
              const { title, hint, icon: Icon, points, badge } = TYPE_INFO[t]
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`${cardCls} space-y-2 text-left hover:border-primary`}
                >
                  <span className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    {badge && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                        {badge}
                      </span>
                    )}
                  </span>
                  <span className="block pt-2 text-lg font-bold">{title}</span>
                  <span className="block text-sm text-muted-foreground">{hint}</span>
                  {points.map((p) => (
                    <span key={p} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4" aria-hidden /> {p}
                    </span>
                  ))}
                  <span className="mt-2 flex h-10 items-center justify-center rounded-lg border text-sm font-semibold">
                    Continue as {title.toLowerCase()}
                  </span>
                </button>
              )
            })}
          </div>
          {types.length > 1 && (
            <p className="text-sm text-muted-foreground">
              Not sure? Choose Individual — you can convert to an organisation later from My
              account.
            </p>
          )}
        </>
      )}

      {type && step !== 'pay' && (
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          <div className={`${cardCls} space-y-5`}>
            {step === 'details' && (
              <>
                {org && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Company / organisation name"
                      required
                      error={errors.legal_name}
                    >
                      <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
                    </FormField>
                    <FormField label="GSTIN" error={errors.gstin}>
                      <Input
                        placeholder="e.g. 37AAKCS1234F1Z5"
                        value={gstin}
                        onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      />
                    </FormField>
                  </div>
                )}
                {!account.email && (
                  <FormField label="Email" required error={errors.email}>
                    <Input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                )}
              </>
            )}
            {(step === 'docs' ? docGroups : detailGroups).map((g) => (
              <FieldGroupView
                key={g.key}
                group={g}
                values={values}
                errors={errors}
                setValues={setValues}
              />
            ))}
            {step === 'docs' && (
              <p className="text-xs text-muted-foreground">
                You can skip and upload later from My account — your membership will wait in
                &quot;Pending approval&quot; until documents are checked.
              </p>
            )}
            {step === 'contacts' && (
              <div className="space-y-3">
                <h2 className="font-semibold">
                  People under this membership{' '}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {contacts.length + 1} of {maxContacts}
                  </span>
                </h2>
                <p className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <span>
                    <b>{account.full_name}</b> <span className="text-xs">(you)</span>
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                    Primary
                  </span>
                </p>
                {contacts.map((c, i) => (
                  <p
                    key={c.email}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <span>
                      <b>{c.name}</b>
                      <span className="block text-xs text-muted-foreground">{c.email}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {
                          {
                            FULL: 'Full access',
                            CONTENT: 'Events & content',
                            BILLING: 'Billing only',
                          }[c.access]
                        }
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${c.name}`}
                        onClick={() => setContacts((x) => x.filter((_, n) => n !== i))}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </span>
                  </p>
                ))}
                {contacts.length + 1 < maxContacts && (
                  <div className="space-y-2">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <FormField label="Name">
                        <Input
                          placeholder="Full name"
                          value={draft.name}
                          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Email">
                        <Input
                          placeholder="name@company.com"
                          value={draft.email}
                          onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Access">
                        <select
                          className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                          value={draft.access}
                          onChange={(e) =>
                            setDraft({ ...draft, access: e.target.value as ContactDraft['access'] })
                          }
                        >
                          <option value="FULL">Full access</option>
                          <option value="CONTENT">Events &amp; content</option>
                          <option value="BILLING">Billing only</option>
                        </select>
                      </FormField>
                    </div>
                    <button
                      type="button"
                      onClick={addContact}
                      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold"
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Add contact ·{' '}
                      {maxContacts - contacts.length - 1} more allowed
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Each person gets their own login and member card. Invites are sent after the
                  membership is approved.
                </p>
              </div>
            )}
            <AuthError>{formError}</AuthError>
            <div className="flex gap-3">
              <button type="button" className={`${outlineBtn} !w-auto`} onClick={back}>
                Back
              </button>
              <button
                type="button"
                className={`${primaryBtn} !w-auto px-6`}
                onClick={step === 'contacts' ? next : validateDetails}
              >
                {step === 'contacts' ? 'Continue to payment' : 'Continue'}
              </button>
            </div>
          </div>
          <MiniSummary plan={plan} price={price} interval={interval} who={who} />
        </div>
      )}

      {type && step === 'pay' && (
        <div className="grid gap-6 md:grid-cols-[1fr_300px]">
          <div className={`${cardCls} space-y-4`}>
            <h2 className="font-semibold">{org ? 'Organisation' : 'Member details'}</h2>
            <dl className="space-y-2 text-sm">
              {[
                ...(org ? [['Company', legalName]] : []),
                ['Name', account.full_name],
                ['Email', account.email || email],
                ['Mobile', account.mobile],
                ...(gstin ? [['GSTIN', gstin]] : []),
                ...(org ? [['People', `${contacts.length + 1} of ${maxContacts}`]] : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {!org && (
              <FormField label="GSTIN for business invoice (optional)" error={errors.gstin}>
                <Input
                  placeholder="e.g. 37XXXXX0000X1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value.toUpperCase())}
                />
              </FormField>
            )}
            {org && gstin && (
              <p className="flex gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  GST invoice will be issued to <b>{legalName}</b> with GSTIN {gstin} — input tax
                  credit available.
                </span>
              </p>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              {org
                ? 'I accept the membership terms on behalf of the organisation'
                : 'I accept the membership terms and refund policy'}
            </label>
            <button type="button" className={`${outlineBtn} !w-auto`} onClick={back}>
              Back
            </button>
          </div>
          <OrderSummary
            plan={plan}
            price={price}
            interval={interval}
            extra={org ? ' · Organisation' : ''}
            action={
              <>
                <AuthError>
                  {formError ?? (signup.error ? errorText(signup.error) : undefined)}
                </AuthError>
                <button
                  type="button"
                  className={primaryBtn}
                  onClick={pay}
                  disabled={signup.isPending}
                >
                  {signup.isPending ? 'Creating your account…' : payLabel(price, plan.is_free)}
                </button>
              </>
            }
            note={
              plan.approval_mode === 'MANUAL'
                ? `${plan.name} needs admin approval.${plan.is_free ? '' : ' Full refund if not approved.'}`
                : undefined
            }
          />
        </div>
      )}
    </div>
  )
}

function FieldGroupView({
  group,
  values,
  errors,
  setValues,
}: {
  group: FieldGroup
  values: Record<string, unknown>
  errors: Record<string, string>
  setValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-semibold">{group.name}</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        {group.fields.map((f) => (
          <FieldInput
            key={f.key}
            field={f}
            value={values[f.key]}
            error={errors[f.key]}
            onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
          />
        ))}
      </div>
    </fieldset>
  )
}

function RestartAccount({ planSlug, interval }: { planSlug: string; interval?: string }) {
  return (
    <div className={`${cardCls} mx-auto max-w-md space-y-3 text-center`}>
      <h1 className="text-xl font-bold">Create your account first</h1>
      <p className="text-sm text-muted-foreground">
        Verify your mobile number or email to continue.
      </p>
      <Link
        href={`/membership/signup?plan=${planSlug}${interval ? `&interval=${interval}` : ''}`}
        className={primaryBtn}
      >
        Continue
      </Link>
    </div>
  )
}

const freeSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  mobile: z.string().refine(validNational, 'Enter a valid 10-digit mobile number'),
  password: z.string().min(8, 'At least 8 characters'),
})

/** Free plans: one short form (or social / mobile) and the membership is active straight away. */
function FreeJoin({ planSlug }: { planSlug: string }) {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const [v, setV] = useState({ full_name: '', email: '', mobile: '', password: '' })
  const [errs, setErrs] = useState<Record<string, string>>({})
  const [terms, setTerms] = useState(false)
  const join = useMutation({
    mutationFn: () =>
      post<SignupResult>('/membership/signup', {
        plan_slug: planSlug,
        member_type: 'INDIVIDUAL',
        ...v,
        mobile: `+91${v.mobile.replace(/\D/g, '')}`,
      }),
    onSuccess: (res) => {
      if (res.user && res.accessToken) setAuth(res.user, res.accessToken)
      router.push(`/membership/success?state=${res.next === 'active' ? 'free' : res.next}`)
    },
  })
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV({ ...v, [k]: e.target.value })
  return (
    <div className="mx-auto max-w-xl space-y-4 py-2">
      <Crumbs plan="Free" current="Join" />
      <h1 className="text-4xl font-extrabold tracking-tight">Join for free</h1>
      <div className={`${cardCls} space-y-4`}>
        <p className="text-xs text-muted-foreground">Join with</p>
        <SocialButtons
          next={`/membership/join/${planSlug}`}
          mobileHref={`/membership/signup?plan=${planSlug}`}
        />
        <AuthDivider>or fill in your details</AuthDivider>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            const r = freeSchema.safeParse(v)
            const out: Record<string, string> = {}
            if (!r.success) for (const i of r.error.issues) out[String(i.path[0])] = i.message
            if (!terms) out.terms = 'Please accept the membership terms'
            setErrs(out)
            if (!Object.keys(out).length) join.mutate()
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Full name" error={errs.full_name}>
              <Input autoComplete="name" value={v.full_name} onChange={set('full_name')} />
            </FormField>
            <FormField label="Email" error={errs.email}>
              <Input type="email" autoComplete="email" value={v.email} onChange={set('email')} />
            </FormField>
            <FormField label="Mobile" error={errs.mobile}>
              <Input
                type="tel"
                autoComplete="tel-national"
                placeholder="98480 12345"
                value={v.mobile}
                onChange={set('mobile')}
              />
            </FormField>
            <FormField label="Password" error={errs.password}>
              <Input
                type="password"
                autoComplete="new-password"
                value={v.password}
                onChange={set('password')}
              />
            </FormField>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={terms}
                onChange={(e) => setTerms(e.target.checked)}
              />
              I agree to the membership terms
            </label>
            {errs.terms && <p className="mt-1 text-xs text-destructive">{errs.terms}</p>}
          </div>
          <AuthError>{join.error ? errorText(join.error) : undefined}</AuthError>
          <button type="submit" className={primaryBtn} disabled={join.isPending}>
            {join.isPending ? 'Creating…' : 'Create free membership'}
          </button>
        </form>
      </div>
    </div>
  )
}
