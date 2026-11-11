'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Crown, Smartphone } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/stores/auth.store'
import { homeFor } from './roles'
import { safeNext } from './safeNext'
import { oauthUrl, useAuthProviders, type LoginResult } from './AuthApi'

/** Split card of the auth screens: brand panel on the left, the form on the right. */
export function AuthShell({
  title,
  subtitle,
  side,
  children,
}: {
  title: string
  subtitle?: string
  side?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto grid max-w-[960px] overflow-hidden rounded-2xl border bg-card md:grid-cols-2">
      <div className="relative flex flex-col justify-center gap-4 bg-primary p-8 text-primary-foreground md:p-11">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/60"
        />
        <div className="relative space-y-4">
          {side ?? (
            <>
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-white/15">
                <Crown className="h-6 w-6" aria-hidden />
              </span>
              <h2 className="text-[26px] font-extrabold leading-tight">{title}</h2>
              {subtitle && <p className="opacity-85">{subtitle}</p>}
            </>
          )}
        </div>
      </div>
      <div className="p-6 md:p-11">{children}</div>
    </div>
  )
}

export const AuthTitle = ({ title, hint }: { title: string; hint?: React.ReactNode }) => (
  <div className="mb-5">
    <h1 className="text-[22px] font-bold">{title}</h1>
    {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
  </div>
)

export const AuthError = ({ children }: { children?: React.ReactNode }) =>
  children ? (
    <p role="alert" className="mb-3 text-sm text-destructive">
      {children}
    </p>
  ) : null

export function AuthDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 flex items-center gap-2.5 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {children}
      <span className="h-px flex-1 bg-border" />
    </div>
  )
}

export const primaryBtn =
  'flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50'
export const outlineBtn =
  'flex h-11 w-full items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-muted/50'
export const linkCls = 'font-semibold text-primary hover:underline'

const BRAND: Record<string, React.ReactNode> = {
  google: (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z"
        fill="#4285F4"
      />
      <path
        d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z"
        fill="#FBBC05"
      />
      <path
        d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z"
        fill="#34A853"
      />
    </svg>
  ),
}
const BADGE: Record<string, [string, string]> = {
  facebook: ['f', '#1877F2'],
  apple: ['', '#000'],
  linkedin: ['in', '#0A66C2'],
}

/** "Continue with Google / Facebook / Apple / LinkedIn": whatever the admin switched on. */
export function SocialButtons({ next, mobileHref }: { next?: string; mobileHref?: string }) {
  const { data } = useAuthProviders()
  if (!data?.length && !mobileHref) return null
  return (
    <div className="flex gap-2">
      {data?.map((p) => {
        const [txt, bg] = BADGE[p.key] ?? [p.label.slice(0, 1), p.color ?? '#475569']
        return (
          <a
            key={p.key}
            href={oauthUrl(p.key, safeNext(next) ?? undefined)}
            className="flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-1.5 text-[13px] font-medium hover:bg-muted/50"
          >
            {BRAND[p.key] ?? (
              <span
                className="inline-flex h-[18px] w-[18px] items-center justify-center rounded text-[10px] font-bold text-white"
                style={{ background: bg }}
              >
                {txt}
              </span>
            )}
            <span>{p.label}</span>
          </a>
        )
      })}
      {mobileHref && (
        <a
          href={mobileHref}
          className="flex h-[42px] flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-1.5 text-[13px] font-medium hover:bg-muted/50"
        >
          <Smartphone className="h-4 w-4" aria-hidden />
          Mobile
        </a>
      )}
    </div>
  )
}

/** Country code + 10-digit national number. */
export function MobileField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (v: string) => void
  error?: string
}) {
  return (
    <div className="mb-4 space-y-1.5">
      <label htmlFor="auth-mobile" className="text-sm font-medium">
        Mobile number
      </label>
      <div className="flex gap-2">
        <div className="flex h-10 w-24 items-center justify-between rounded-md border bg-background px-3 text-sm">
          <b className="text-xs">IN</b> +91
        </div>
        <Input
          id="auth-mobile"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          maxLength={11}
          placeholder="98480 12345"
          className="flex-1 text-base tracking-wide"
          value={value}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value.replace(/[^\d ]/g, ''))}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export const SmsHint = () => (
  <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground">
    <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
    <span>
      We&apos;ll send a 6-digit code by SMS — and WhatsApp if you use it. No password needed.
    </span>
  </p>
)

/** Six single-digit boxes with auto-advance, backspace and paste. */
export function OtpBoxes({
  value,
  onChange,
  invalid,
}: {
  value: string
  onChange: (v: string) => void
  invalid?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const set = (i: number, d: string) => {
    const next = value.padEnd(6, ' ').split('')
    next[i] = d || ' '
    onChange(next.join('').trimEnd().replace(/ /g, ''))
    if (d && i < 5) refs.current[i + 1]?.focus()
  }
  return (
    <div className="mb-4 flex gap-2" role="group" aria-label="6-digit code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={invalid}
          value={value[i] ?? ''}
          autoFocus={i === 0}
          onChange={(e) => set(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus()
          }}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (t) {
              e.preventDefault()
              onChange(t)
              refs.current[Math.min(t.length, 5)]?.focus()
            }
          }}
          className={`h-12 w-full min-w-0 rounded-md border bg-background text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-ring ${invalid ? 'border-destructive' : ''}`}
        />
      ))}
    </div>
  )
}

/** Counts down from `seconds`; `restart(n)` starts it again. */
export function useCountdown(initial = 30) {
  const [left, setLeft] = useState(initial)
  useEffect(() => {
    if (left <= 0) return
    const t = setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [left])
  return [left, setLeft, `0:${String(left).padStart(2, '0')}`] as const
}

/** Stores the session from a login response and goes to the member's home (or `next`). */
export function useFinishLogin() {
  const router = useRouter()
  const { setAuth } = useAuthStore()
  return (res: LoginResult, next?: string | null) => {
    setAuth(res.user, res.accessToken)
    router.replace(
      res.user.must_change_password ? '/change-password' : (safeNext(next) ?? homeFor(res.user))
    )
  }
}
