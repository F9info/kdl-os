'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Building2, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { ErrorAlert } from '@/components/shared/ErrorAlert'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/models.types'
import { post, useJoinForm, usePlans } from './api'
import { FieldInput, missingRequired } from './FieldInput'
import { INTERVAL_TITLE, money, priceFor, priceTotals } from './format'
import type { Interval, MemberType } from './types'

const schema = z.object({
  mobile: z.string().regex(/^[+0-9\s-]{8,15}$/, 'Enter a valid mobile number'),
  full_name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(12, 'Password must be at least 12 characters'),
  legal_name: z.string().optional(),
  gstin: z.string().optional(),
})
type Account = z.infer<typeof schema>

interface SignupResult {
  next: 'checkout' | 'active' | 'approval'
  user?: User
  accessToken?: string
}

const TYPE_INFO: Record<MemberType, { title: string; hint: string; icon: typeof UserIcon }> = {
  INDIVIDUAL: { title: 'Individual', hint: 'Join as yourself', icon: UserIcon },
  ORGANISATION: {
    title: 'Organisation',
    hint: 'Join for your company or institution',
    icon: Building2,
  },
}

export function JoinFlow({ planSlug, interval: wanted }: { planSlug: string; interval?: string }) {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  const { data: plans, isLoading } = usePlans()
  const plan = plans?.find((p) => p.slug === planSlug)
  const [type, setType] = useState<MemberType | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [values, setValues] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const { data: groups = [], isLoading: groupsLoading } = useJoinForm(planSlug, type ?? undefined)
  const form = useForm<Account>({ resolver: zodResolver(schema) })

  const interval = (
    plan?.prices.some((p) => p.interval === wanted) ? wanted : plan?.prices[0]?.interval
  ) as Interval | undefined

  const signup = useMutation({
    mutationFn: (acc: Account) =>
      post<SignupResult>('/membership/signup', {
        plan_slug: planSlug,
        interval,
        member_type: type,
        ...acc,
        legal_name: acc.legal_name || undefined,
        gstin: acc.gstin || undefined,
        fields: values,
      }),
    onSuccess: (res) => {
      if (res.user && res.accessToken) setAuth(res.user, res.accessToken)
      router.push(
        res.next === 'checkout'
          ? `/membership/checkout?plan=${planSlug}&interval=${interval ?? ''}`
          : `/membership/success?state=${res.next}`
      )
    },
  })

  if (isLoading) return <LoadingSpinner />
  if (!plan) return <ErrorAlert error={new Error('This plan is not available.')} />
  const types = plan.member_types?.length
    ? plan.member_types
    : (['INDIVIDUAL', 'ORGANISATION'] as MemberType[])
  const price = interval ? priceFor(plan, interval) : undefined
  const step = !type ? 1 : !account ? 2 : 3

  const finish = () => {
    const missing = missingRequired(groups, values)
    setErrors(missing)
    if (!Object.keys(missing).length && account) signup.mutate(account)
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-8 md:grid-cols-[1fr_280px]">
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">Step {step} of 3</p>

        {step === 1 && (
          <section className="space-y-4">
            <h1 className="text-2xl font-bold">How are you joining?</h1>
            <div className="grid gap-4 sm:grid-cols-2">
              {types.map((t) => {
                const { title, hint, icon: Icon } = TYPE_INFO[t]
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className="rounded-xl border bg-card p-5 text-left hover:border-primary"
                  >
                    <Icon className="mb-2 h-6 w-6 text-primary" aria-hidden />
                    <div className="font-semibold">{title}</div>
                    <div className="text-sm text-muted-foreground">{hint}</div>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {step === 2 && (
          <form
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit((a) => {
              setAccount(a)
              if (!groups.length) signup.mutate(a)
            })}
          >
            <h1 className="text-2xl font-bold">Create your account</h1>
            <FormField label="Mobile number" required error={form.formState.errors.mobile?.message}>
              <Input type="tel" autoComplete="tel" {...form.register('mobile')} />
            </FormField>
            <FormField label="Full name" required error={form.formState.errors.full_name?.message}>
              <Input autoComplete="name" {...form.register('full_name')} />
            </FormField>
            <FormField label="Email" required error={form.formState.errors.email?.message}>
              <Input type="email" autoComplete="email" {...form.register('email')} />
            </FormField>
            <FormField label="Password" required error={form.formState.errors.password?.message}>
              <Input type="password" autoComplete="new-password" {...form.register('password')} />
            </FormField>
            {type === 'ORGANISATION' && (
              <>
                <FormField label="Organisation legal name">
                  <Input {...form.register('legal_name')} />
                </FormField>
                <FormField label="GSTIN (optional)">
                  <Input {...form.register('gstin')} />
                </FormField>
              </>
            )}
            {signup.error && <ErrorAlert error={signup.error} />}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setType(null)}>
                Back
              </Button>
              <Button type="submit" disabled={signup.isPending || groupsLoading}>
                {groups.length ? 'Continue' : 'Create account'}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <section className="space-y-5">
            <h1 className="text-2xl font-bold">Your profile</h1>
            {groups.map((g) => (
              <fieldset key={g.key} className="space-y-3 rounded-xl border bg-card p-4">
                <legend className="px-1 font-medium">{g.name}</legend>
                {g.fields.map((f) => (
                  <FieldInput
                    key={f.key}
                    field={f}
                    value={values[f.key]}
                    error={errors[f.key]}
                    onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))}
                  />
                ))}
              </fieldset>
            ))}
            {signup.error && <ErrorAlert error={signup.error} />}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setAccount(null)}>
                Back
              </Button>
              <Button type="button" onClick={finish} disabled={signup.isPending}>
                Create account
              </Button>
            </div>
          </section>
        )}
      </div>

      <aside
        className="h-fit space-y-2 rounded-xl border bg-card p-4 text-sm"
        aria-label="Order summary"
      >
        <h2 className="font-semibold">{plan.name}</h2>
        {plan.is_free || !price ? (
          <p className="text-muted-foreground">Free plan</p>
        ) : (
          <>
            <p className="text-muted-foreground">
              Billed {INTERVAL_TITLE[price.interval].toLowerCase()}
            </p>
            <p className="text-lg font-bold">{money(priceTotals(price).total, price.currency)}</p>
            <p className="text-xs text-muted-foreground">incl. {price.gst_rate}% GST</p>
          </>
        )}
        {plan.approval_mode === 'MANUAL' && (
          <p className="text-xs text-muted-foreground">
            {plan.name} needs admin approval after payment.
          </p>
        )}
      </aside>
    </div>
  )
}
