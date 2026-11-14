import { useQuery } from '@tanstack/react-query'
import axios, { isAxiosError } from 'axios'
import type { User } from '@/types/models.types'
import { API_URL } from '@/lib/api-url'

/**
 * Public calls without the app's axios interceptors: a 401 here must show a message, not trigger the
 * refresh-and-redirect-to-/login handling meant for expired admin sessions.
 */
export const pub = axios.create({
  baseURL: API_URL,
  timeout: 10_000,
  withCredentials: true,
})
export const post = <T>(url: string, body?: unknown) =>
  pub.post<{ data: T }>(url, body).then((r) => r.data.data)

// Auth API of the membership module (docs/MEMBERSHIP_API_CONTRACT.md addendum).
export interface AuthProvider {
  key: string
  label: string
  icon?: string
  color?: string
  enabled?: boolean
}
export interface LoginResult {
  user: User
  accessToken: string
}
export type OtpVerifyResult = Partial<LoginResult> & {
  needs_signup?: boolean
  verification_token?: string
}
export interface OtpSent {
  sent: boolean
  expires_in?: number
  resend_in?: number
  dev_code?: string
}

/** The last send result, so the code screen can show the resend timer and the dev code. */
export const lastSent: { value: OtpSent | null } = { value: null }
export const sendOtp = (mobile: string, purpose: 'login' | 'signup', channel?: 'whatsapp') =>
  post<OtpSent>('/membership/auth/otp/send', { mobile, purpose, channel }).then((r) => {
    lastSent.value = r
    return r
  })
export const verifyOtp = (mobile: string, code: string, remember?: boolean) =>
  post<OtpVerifyResult>('/membership/auth/otp/verify', { mobile, code, remember })
export const linkAccount = (provider: string, password: string, email?: string) =>
  post<LoginResult>('/membership/auth/link', { provider, password, email })

/** True when the endpoint is not there yet (the auth API is built in parallel): show a soft state. */
export const isMissing = (e: unknown) =>
  isAxiosError(e) && [404, 501].includes(e.response?.status ?? 0)

export const errorText = (e: unknown, fallback = 'Something went wrong. Please try again.') =>
  isMissing(e)
    ? 'This sign-in method is not available yet. Please use another option.'
    : isAxiosError(e)
      ? ((e.response?.data as { message?: string } | undefined)?.message ?? fallback)
      : fallback

/** Enabled social providers, in the admin's order. A missing endpoint just means no buttons. */
export const useAuthProviders = () =>
  useQuery({
    queryKey: ['membership', 'auth-providers'],
    retry: false,
    queryFn: () =>
      pub
        .get<{ data: AuthProvider[] | { items: AuthProvider[] } }>('/membership/auth/providers')
        .then((r) => {
          const d = r.data.data
          return (Array.isArray(d) ? d : (d?.items ?? [])).filter((p) => p.enabled !== false)
        })
        .catch((e) => (isMissing(e) || isAxiosError(e) ? [] : Promise.reject(e))),
  })

export const oauthUrl = (provider: string, next?: string) =>
  `${pub.defaults.baseURL}/membership/auth/oauth/${provider}${next ? `?next=${encodeURIComponent(next)}` : ''}`

/** Mobile as the API expects it: country code + 10 digits. */
export const toE164 = (national: string, cc = '+91') => `${cc}${national.replace(/\D/g, '')}`
export const validNational = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''))
