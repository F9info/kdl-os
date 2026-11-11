'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import { Check, Eye, EyeOff, Mail, Smartphone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/shared/FormField'
import { useAuthStore } from '@/stores/auth.store'
import type { User } from '@/types/models.types'
import { usePlans } from './api'
import { INTERVAL_TITLE } from './format'
import type { Interval } from './types'
import {
  errorText,
  lastSent,
  linkAccount,
  post,
  pub,
  sendOtp,
  toE164,
  validNational,
  verifyOtp,
} from './AuthApi'
import {
  AuthDivider,
  AuthError,
  AuthShell,
  AuthTitle,
  linkCls,
  MobileField,
  OtpBoxes,
  outlineBtn,
  primaryBtn,
  SmsHint,
  SocialButtons,
  useCountdown,
  useFinishLogin,
} from './AuthShell'
import { safeNext } from './safeNext'
import { getJoinAccount, setJoinAccount } from './JoinState'

const qs = (sp: URLSearchParams) => {
  const keep = new URLSearchParams()
  for (const k of ['plan', 'interval']) if (sp.get(k)) keep.set(k, sp.get(k)!)
  const next = safeNext(sp.get('next'))
  if (next) keep.set('next', next)
  const s = keep.toString()
  return s ? `?${s}` : ''
}
const joinUrl = (sp: URLSearchParams) =>
  sp.get('plan')
    ? `/membership/join/${sp.get('plan')}${sp.get('interval') ? `?interval=${sp.get('interval')}` : ''}`
    : '/membership'

/** The plan being joined (from ?plan=&interval=), for the signup side panel. */
function useSide(step: number) {
  const sp = useSearchParams()
  const { data: plans } = usePlans()
  const plan = plans?.find((p) => p.slug === sp.get('plan'))
  const interval = sp.get('interval') as Interval | null
  const planLabel = plan
    ? `${plan.name}${interval && INTERVAL_TITLE[interval] ? ` · ${INTERVAL_TITLE[interval]}` : ''}`
    : undefined
  return (
    <SignupSide planLabel={planLabel} benefits={plan?.benefits.map((b) => b.text)} step={step} />
  )
}

/** Mobile entry shared by /login and /signup: one number, one OTP, no password. */
export function AuthMobile({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const sp = useSearchParams()
  const [mobile, setMobile] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()
  const [terms, setTerms] = useState(false)
  const login = mode === 'login'
  const side = useSide(1)
  const send = useMutation({
    mutationFn: () => sendOtp(toE164(mobile), mode),
    onSuccess: () => {
      if (!login) setJoinAccount({ ...getJoinAccount(), full_name: name.trim() })
      router.push(
        `/membership/${mode}/otp${qs(sp)}${qs(sp) ? '&' : '?'}mobile=${mobile.replace(/\D/g, '')}`
      )
    },
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validNational(mobile)) return setError('Enter a valid 10-digit mobile number')
    if (!login && name.trim().length < 2) return setError('Enter your name')
    if (!login && !terms) return setError('Please accept the Terms and Privacy Policy')
    setError(undefined)
    send.mutate()
  }
  return (
    <AuthShell title="Members area" subtitle="Membership login" side={login ? undefined : side}>
      <AuthTitle
        title={login ? 'Log in' : 'Sign up'}
        hint={
          login ? (
            'Welcome back! Log in with your mobile number.'
          ) : (
            <>
              Already have an account?{' '}
              <Link href={`/membership/login${qs(sp)}`} className={linkCls}>
                Log in
              </Link>
            </>
          )
        }
      />
      <form onSubmit={submit} noValidate>
        {!login && (
          <FormField label="Full name" required className="mb-4">
            <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>
        )}
        <MobileField value={mobile} onChange={setMobile} />
        <SmsHint />
        {!login && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
            />
            I agree to the Terms and Privacy Policy
          </label>
        )}
        <AuthError>{error ?? (send.error ? errorText(send.error) : undefined)}</AuthError>
        <button type="submit" className={primaryBtn} disabled={send.isPending}>
          {send.isPending ? 'Sending…' : login ? 'Send OTP' : 'Send OTP & continue'}
        </button>
      </form>
      <AuthDivider>{login ? 'or continue with' : 'or sign up with'}</AuthDivider>
      <SocialButtons next={sp.get('next') ?? (login ? undefined : joinUrl(sp))} />
      <p className="mt-4 text-center text-sm">
        <Link
          href={`/membership/${mode}/email${qs(sp)}`}
          className={`${linkCls} inline-flex items-center gap-1.5`}
        >
          <Mail className="h-4 w-4" aria-hidden />
          {login ? 'Log in with email & password instead' : 'Sign up with email & password instead'}
        </Link>
      </p>
      {login && (
        <p className="mt-2.5 text-center text-sm text-muted-foreground">
          New here?{' '}
          <Link href="/membership" className={linkCls}>
            Become a member
          </Link>
        </p>
      )}
    </AuthShell>
  )
}

/** The 6-digit code screen (login and signup). */
export function AuthOtp({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const sp = useSearchParams()
  const finish = useFinishLogin()
  const mobile = sp.get('mobile') ?? ''
  const [code, setCode] = useState('')
  const [keep, setKeep] = useState(true)
  const [notice, setNotice] = useState<string>()
  const [left, setLeft, clock] = useCountdown(lastSent.value?.resend_in ?? 30)
  const login = mode === 'login'
  const e164 = toE164(mobile)

  const verify = useMutation({
    mutationFn: () => verifyOtp(e164, code, keep),
    onSuccess: (res) => {
      if (res.user && res.accessToken) {
        return finish({ user: res.user, accessToken: res.accessToken }, sp.get('next'))
      }
      if (login) {
        setNotice("We couldn't find a membership for this number.")
        return
      }
      setJoinAccount({
        ...getJoinAccount(),
        mobile: e164,
        verification_token: res.verification_token,
      })
      router.push(joinUrl(sp))
    },
  })
  const resend = useMutation({
    mutationFn: (ch?: 'whatsapp') => sendOtp(e164, mode, ch),
    onSuccess: (r) => {
      setLeft(r.resend_in ?? 30)
      setCode('')
      verify.reset()
    },
  })
  const err = verify.error ?? resend.error
  return (
    <AuthShell
      title={login ? 'Members area' : 'Almost there'}
      subtitle={login ? 'Membership login' : 'Step 1 of 3 · verifying your mobile'}
    >
      <AuthTitle
        title={login ? 'Enter the code' : 'Verify your mobile'}
        hint={`${login ? 'Sent' : 'Code sent'} by SMS to +91 ${mobile.replace(/(\d{5})(\d+)/, '$1 $2')}`}
      />
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (code.length === 6) verify.mutate()
        }}
      >
        <OtpBoxes value={code} onChange={setCode} invalid={!!verify.error} />
        {lastSent.value?.dev_code && (
          <p className="mb-3 text-xs text-muted-foreground">Test code: {lastSent.value.dev_code}</p>
        )}
        {login && (
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={keep}
              onChange={(e) => setKeep(e.target.checked)}
            />
            Keep me logged in on this device
          </label>
        )}
        <AuthError>
          {notice ??
            (err ? errorText(err, "That code isn't right. Check it and try again.") : undefined)}
        </AuthError>
        {notice && (
          <p className="mb-3 text-sm">
            <Link href="/membership" className={linkCls}>
              Become a member
            </Link>
          </p>
        )}
        <button type="submit" className={primaryBtn} disabled={code.length < 6 || verify.isPending}>
          {verify.isPending ? 'Verifying…' : login ? 'Verify & log in' : 'Verify & continue'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Didn&apos;t get it?{' '}
        {left > 0 ? (
          <>Resend in {clock}</>
        ) : (
          <button type="button" className={linkCls} onClick={() => resend.mutate(undefined)}>
            Resend
          </button>
        )}
        {!login && (
          <>
            {' · '}
            <button type="button" className={linkCls} onClick={() => resend.mutate('whatsapp')}>
              Send on WhatsApp
            </button>
          </>
        )}
        {' · '}
        <Link href={`/membership/${mode}${qs(sp)}`} className={linkCls}>
          Change number
        </Link>
      </p>
    </AuthShell>
  )
}

const PasswordInput = ({ show, ...p }: React.ComponentProps<typeof Input> & { show: boolean }) => (
  <Input type={show ? 'text' : 'password'} {...p} />
)

const emailLogin = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
})

/** Second way in: email + password (the admin /login stays separate). */
export function AuthEmailLogin() {
  const sp = useSearchParams()
  const finish = useFinishLogin()
  const [show, setShow] = useState(false)
  const form = useForm<z.infer<typeof emailLogin>>({ resolver: zodResolver(emailLogin) })
  const login = useMutation({
    mutationFn: (d: z.infer<typeof emailLogin>) =>
      pub
        .post<{ data: { user: User; accessToken: string } }>('/auth/login', d)
        .then((r) => r.data.data),
    onSuccess: (r) => finish(r, sp.get('next')),
  })
  const e = form.formState.errors
  return (
    <AuthShell title="Members area" subtitle="Membership login">
      <AuthTitle title="Log in with email" hint="Use the email and password you set up." />
      <form onSubmit={form.handleSubmit((d) => login.mutate(d))} noValidate className="space-y-4">
        <FormField label="Email" error={e.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Password" error={e.password?.message}>
          <div className="relative">
            <PasswordInput
              show={show}
              autoComplete="current-password"
              {...form.register('password')}
            />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-2.5 text-muted-foreground"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" defaultChecked />
            Keep me logged in
          </label>
          <Link href="/membership/forgot" className={linkCls}>
            Forgot password?
          </Link>
        </div>
        <AuthError>
          {login.error ? errorText(login.error, 'Wrong email or password.') : undefined}
        </AuthError>
        <button type="submit" className={primaryBtn} disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <AuthDivider>or continue with</AuthDivider>
      <SocialButtons next={sp.get('next') ?? undefined} />
      <p className="mt-4 text-center text-sm">
        <Link href="/membership/login" className={`${linkCls} inline-flex items-center gap-1.5`}>
          <Smartphone className="h-4 w-4" aria-hidden />
          Use mobile number & OTP instead
        </Link>
      </p>
    </AuthShell>
  )
}

const emailSignup = z.object({
  full_name: z.string().trim().min(2, 'Enter your name'),
  mobile: z.string().refine(validNational, 'Enter a valid 10-digit mobile number'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  terms: z.literal(true, { message: 'Please accept the Terms and Privacy Policy' }),
})

/** Sign up with email: collects the account, then the join flow creates it with the plan. */
export function AuthEmailSignup() {
  const side = useSide(1)
  const router = useRouter()
  const sp = useSearchParams()
  const [show, setShow] = useState(false)
  const form = useForm<z.infer<typeof emailSignup>>({ resolver: zodResolver(emailSignup) })
  const e = form.formState.errors
  return (
    <AuthShell title="Create your account" side={side}>
      <AuthTitle
        title="Sign up with email"
        hint={
          <>
            Already have an account?{' '}
            <Link href={`/membership/login${qs(sp)}`} className={linkCls}>
              Log in
            </Link>
          </>
        }
      />
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((d) => {
          setJoinAccount({
            full_name: d.full_name,
            mobile: toE164(d.mobile),
            email: d.email,
            password: d.password,
          })
          router.push(`/membership/verify${qs(sp)}`)
        })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Full name" error={e.full_name?.message}>
            <Input autoComplete="name" {...form.register('full_name')} />
          </FormField>
          <FormField label="Mobile" error={e.mobile?.message}>
            <Input
              type="tel"
              autoComplete="tel-national"
              placeholder="98480 12345"
              {...form.register('mobile')}
            />
          </FormField>
        </div>
        <FormField label="Email" error={e.email?.message}>
          <Input type="email" autoComplete="email" {...form.register('email')} />
        </FormField>
        <FormField label="Password" error={e.password?.message}>
          <div className="relative">
            <PasswordInput show={show} autoComplete="new-password" {...form.register('password')} />
            <button
              type="button"
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-2.5 text-muted-foreground"
              onClick={() => setShow((s) => !s)}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormField>
        <div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" {...form.register('terms')} />I agree to the
            Terms and Privacy Policy
          </label>
          {e.terms && <p className="mt-1 text-xs text-destructive">{e.terms.message}</p>}
        </div>
        <button type="submit" className={primaryBtn}>
          Create account & continue
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link
          href={`/membership/signup${qs(sp)}`}
          className={`${linkCls} inline-flex items-center gap-1.5`}
        >
          <Smartphone className="h-4 w-4" aria-hidden />
          Use mobile number & OTP instead
        </Link>
      </p>
    </AuthShell>
  )
}

/** Left panel of the signup screens: the plan being joined and the 3 steps. */
export function SignupSide({
  planLabel,
  benefits = [],
  step,
}: {
  planLabel?: string
  benefits?: string[]
  step: number
}) {
  return (
    <>
      <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold">
        Step {step} of 3
      </span>
      <h2 className="text-[26px] font-extrabold leading-tight">Create your account</h2>
      {planLabel && (
        <p className="opacity-90">
          You&apos;re joining <b>{planLabel}</b>
        </p>
      )}
      <ul className="space-y-2.5 rounded-xl bg-white/10 p-4 text-sm">
        {[...benefits.slice(0, 3), 'GST invoice on every payment'].map((b) => (
          <li key={b} className="flex items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            {b}
          </li>
        ))}
      </ul>
      <ol className="flex gap-4 pt-2 text-sm">
        {['Account', 'Details', 'Payment'].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`flex h-[26px] w-[26px] items-center justify-center rounded-full text-xs font-bold ${i + 1 === step ? 'bg-white text-primary' : 'bg-white/25'}`}
            >
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </>
  )
}

/** Email verification code. Skipped when the server has no email-code endpoint yet. */
export function AuthVerifyEmail() {
  const router = useRouter()
  const sp = useSearchParams()
  const account = getJoinAccount()
  const [code, setCode] = useState('')
  const [left, setLeft, clock] = useCountdown(30)
  const [sent, setSent] = useState(false)
  const send = useMutation({
    mutationFn: () => post('/membership/auth/email/send', { email: account?.email }),
    onSuccess: () => {
      setSent(true)
      setLeft(30)
    },
  })
  const verify = useMutation({
    mutationFn: () =>
      post<{ verification_token?: string }>('/membership/auth/email/verify', {
        email: account?.email,
        code,
      }),
    onSuccess: (r) => {
      setJoinAccount({ ...account, verification_token: r.verification_token })
      router.push(joinUrl(sp))
    },
  })
  if (!account?.email)
    return (
      <AuthShell title="Almost there">
        <AuthTitle title="Start again" hint="Your sign-up details were not kept." />
        <Link href={`/membership/signup/email${qs(sp)}`} className={primaryBtn}>
          Back to sign up
        </Link>
      </AuthShell>
    )
  const notYet = send.error && errorText(send.error).includes('not available')
  return (
    <AuthShell title="Almost there" subtitle="Step 1 of 3 · verifying your account">
      <AuthTitle
        title="Verify your email"
        hint={`We ${sent ? 'sent' : 'will send'} a 6-digit code to ${account.email}`}
      />
      {!sent ? (
        <>
          <AuthError>{send.error && !notYet ? errorText(send.error) : undefined}</AuthError>
          {notYet ? (
            <>
              <p className="mb-3 text-sm text-muted-foreground">
                Email codes are not switched on yet, so you can carry on without one.
              </p>
              <button type="button" className={primaryBtn} onClick={() => router.push(joinUrl(sp))}>
                Continue
              </button>
            </>
          ) : (
            <button
              type="button"
              className={primaryBtn}
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? 'Sending…' : 'Send code'}
            </button>
          )}
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (code.length === 6) verify.mutate()
          }}
        >
          <OtpBoxes value={code} onChange={setCode} invalid={!!verify.error} />
          <AuthError>
            {verify.error ? errorText(verify.error, "That code isn't right.") : undefined}
          </AuthError>
          <button
            type="submit"
            className={primaryBtn}
            disabled={code.length < 6 || verify.isPending}
          >
            {verify.isPending ? 'Verifying…' : 'Verify & continue'}
          </button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Didn&apos;t get it?{' '}
            {left > 0 ? (
              <>Resend code in {clock}</>
            ) : (
              <button type="button" className={linkCls} onClick={() => send.mutate()}>
                Resend code
              </button>
            )}
            {' · '}
            <Link href={`/membership/signup/email${qs(sp)}`} className={linkCls}>
              Change email
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}

/** Forgot password: always answers the same, so it cannot be used to find who is a member. */
export function AuthForgot() {
  const [email, setEmail] = useState('')
  const [bad, setBad] = useState<string>()
  const send = useMutation({ mutationFn: () => pub.post('/auth/forgot-password', { email }) })
  return (
    <AuthShell title="Members area" subtitle="Membership login">
      <AuthTitle title="Forgot password" hint="Enter your email and we'll send you a reset link." />
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!z.string().email().safeParse(email).success) return setBad('Enter a valid email')
          setBad(undefined)
          send.mutate()
        }}
      >
        <FormField label="Email" error={bad}>
          <Input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>
        <AuthError>{send.error ? errorText(send.error) : undefined}</AuthError>
        <button type="submit" className={primaryBtn} disabled={send.isPending}>
          {send.isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
      {send.isSuccess && (
        <p
          role="status"
          className="mt-4 flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm"
        >
          <Check className="h-4 w-4 shrink-0 text-green-600" aria-hidden />
          Reset link sent — check your inbox. Link expires in 30 minutes.
        </p>
      )}
      <p className="mt-4 text-sm">
        No password needed:{' '}
        <Link href="/membership/login" className={linkCls}>
          Log in with mobile OTP
        </Link>
      </p>
      <p className="mt-2 text-sm">
        <Link href="/membership/login" className={linkCls}>
          ← Back to log in
        </Link>
      </p>
    </AuthShell>
  )
}

const resetSchema = z
  .object({
    password: z.string().min(12, 'Use at least 12 characters'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'Passwords do not match' })

export function AuthReset() {
  const router = useRouter()
  const token = useSearchParams().get('token')
  const form = useForm<z.infer<typeof resetSchema>>({ resolver: zodResolver(resetSchema) })
  const pw = form.watch('password') ?? ''
  const reset = useMutation({
    mutationFn: (d: z.infer<typeof resetSchema>) =>
      pub.post('/auth/reset-password', { token, password: d.password, confirmPassword: d.confirm }),
    onSuccess: () => router.replace('/membership/login'),
  })
  const e = form.formState.errors
  return (
    <AuthShell title="Members area" subtitle="Membership login">
      <AuthTitle title="Set a new password" />
      {!token ? (
        <AuthError>This reset link is invalid or has expired. Ask for a new one.</AuthError>
      ) : null}
      <form onSubmit={form.handleSubmit((d) => reset.mutate(d))} noValidate className="space-y-4">
        <FormField label="New password" error={e.password?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </FormField>
        <p className="-mt-2 text-xs text-muted-foreground">
          {pw.length >= 12 ? 'Strong · 12+ characters' : `${pw.length}/12 characters`}
        </p>
        <FormField label="Confirm password" error={e.confirm?.message}>
          <Input type="password" autoComplete="new-password" {...form.register('confirm')} />
        </FormField>
        <AuthError>
          {reset.error
            ? errorText(reset.error, 'This reset link is invalid or has expired.')
            : undefined}
        </AuthError>
        <button type="submit" className={primaryBtn} disabled={!token || reset.isPending}>
          {reset.isPending ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </AuthShell>
  )
}

/** A social sign-in landed on an email that already has a password account: link it. */
export function AuthLinkAccount() {
  const sp = useSearchParams()
  const finish = useFinishLogin()
  const provider = sp.get('provider') ?? ''
  const email = sp.get('email') ?? ''
  const [password, setPassword] = useState('')
  const name = provider ? provider[0]!.toUpperCase() + provider.slice(1) : 'your account'
  const link = useMutation({
    mutationFn: () => linkAccount(provider, password, email || undefined),
    onSuccess: (r) => finish(r, sp.get('next')),
  })
  return (
    <AuthShell title="Link your accounts" subtitle="Keep one membership, log in either way">
      <AuthTitle
        title="This email already has an account"
        hint={`${email || 'This email'} is registered with a password.`}
      />
      <p className="mb-4 flex gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Log in once with your password to <b>link {name}</b>. Next time just click Continue with{' '}
          {name}.
        </span>
      </p>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (password) link.mutate()
        }}
      >
        <FormField label="Email">
          <Input value={email} readOnly />
        </FormField>
        <FormField label="Password">
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </FormField>
        <AuthError>{link.error ? errorText(link.error, 'Wrong password.') : undefined}</AuthError>
        <button type="submit" className={primaryBtn} disabled={!password || link.isPending}>
          {link.isPending ? 'Linking…' : `Link ${name} & log in`}
        </button>
        <Link href="/membership/login" className={outlineBtn}>
          <Smartphone className="h-4 w-4" aria-hidden /> Verify with mobile OTP instead
        </Link>
      </form>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link href="/membership/forgot" className={linkCls}>
          Forgot password?
        </Link>
        {' · '}
        <Link href="/membership/login" className={linkCls}>
          Use a different account
        </Link>
      </p>
    </AuthShell>
  )
}

/** After a social sign-in that did not share everything the plan needs (mobile, city, terms). */
export function AuthCompleteProfile() {
  const router = useRouter()
  const sp = useSearchParams()
  const { user } = useAuthStore()
  const account = getJoinAccount()
  const [mobile, setMobile] = useState(account?.mobile?.replace('+91', '') ?? '')
  const [city, setCity] = useState('')
  const [terms, setTerms] = useState(false)
  const [err, setErr] = useState<string>()
  const email = account?.email ?? user?.email ?? sp.get('email') ?? ''
  const name = account?.full_name ?? user?.name ?? ''
  const provider = account?.provider ?? sp.get('provider') ?? 'your account'
  const go = () => {
    if (!validNational(mobile)) return setErr('Enter a valid 10-digit mobile number')
    if (!city.trim()) return setErr('Enter your city')
    if (!terms) return setErr('Please accept the Terms and Privacy Policy')
    setJoinAccount({
      ...account,
      full_name: name,
      email,
      mobile: toE164(mobile),
      provider,
      verification_token: sp.get('token') ?? account?.verification_token,
    })
    router.push(joinUrl(sp))
  }
  return (
    <div className="mx-auto max-w-xl space-y-4 rounded-2xl border bg-card p-6 md:p-9">
      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 p-3 text-sm">
        <Check className="h-4 w-4 text-green-600" aria-hidden />
        <span>
          <b>Signed in with {provider}</b>
          <span className="block text-xs text-muted-foreground">{email} · email verified</span>
        </span>
      </p>
      <h1 className="text-2xl font-bold">Almost done{name ? `, ${name.split(' ')[0]}` : ''}</h1>
      <p className="text-muted-foreground">
        We just need a few details {provider} didn&apos;t share.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name">
          <Input value={name} readOnly />
        </FormField>
        <FormField label="Email">
          <Input value={email} readOnly />
        </FormField>
        <FormField label="Mobile" required>
          <Input
            type="tel"
            placeholder="98480 12345"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </FormField>
        <FormField label="City" required>
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </FormField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={terms}
          onChange={(e) => setTerms(e.target.checked)}
        />
        I agree to the Terms and Privacy Policy
      </label>
      <AuthError>{err}</AuthError>
      <button type="button" className={primaryBtn} onClick={go}>
        Continue
      </button>
      <p className="text-xs text-muted-foreground">
        No password needed — log in with {provider} or your mobile number. You can add a password
        later in Security.
      </p>
    </div>
  )
}
