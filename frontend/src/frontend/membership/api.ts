import { useQuery } from '@tanstack/react-query'
import api from '@/lib/axios'
import { asList } from './format'
import type {
  FieldGroup,
  Interval,
  Invoice,
  LibraryItem,
  MeData,
  MemberType,
  Payment,
  Plan,
  Provider,
} from './types'

const get = <T>(url: string, params?: Record<string, unknown>) =>
  api.get<{ data: T }>(url, { params }).then((r) => r.data.data)

export const usePlans = () =>
  useQuery({
    queryKey: ['membership', 'plans'],
    queryFn: () => get<unknown>('/membership/plans').then((d) => asList<Plan>(d)),
  })

export const useJoinForm = (planSlug: string | undefined, memberType: MemberType | undefined) =>
  useQuery({
    queryKey: ['membership', 'join-form', planSlug, memberType],
    enabled: !!planSlug && !!memberType,
    queryFn: () =>
      get<{ groups?: FieldGroup[] }>(`/membership/join-form/${planSlug}`, {
        member_type: memberType,
      }).then((d) => d.groups ?? []),
  })

export const useMe = (enabled = true) =>
  useQuery({
    queryKey: ['membership', 'me'],
    enabled,
    retry: false,
    queryFn: () => get<MeData>('/membership/me'),
  })

export const useProviders = (planSlug?: string, interval?: Interval) =>
  useQuery({
    queryKey: ['membership', 'providers', planSlug, interval],
    enabled: !!planSlug,
    queryFn: () =>
      get<unknown>('/membership/checkout/providers', {
        plan_slug: planSlug,
        interval,
      }).then((d) => asList<Provider>(d)),
  })

export interface CheckoutQuote {
  total: number
  tax: number
  list_total: number
  discount: number
  coupon_code: string | null
  currency: string
}

/** What checkout will charge, with an optional coupon applied. A bad code makes the query fail with the reason. */
export const useCheckoutQuote = (planSlug?: string, interval?: Interval, coupon?: string) =>
  useQuery({
    queryKey: ['membership', 'quote', planSlug, interval, coupon],
    enabled: !!planSlug,
    retry: false,
    queryFn: () =>
      get<{ quote: CheckoutQuote | null }>('/membership/checkout/providers', {
        plan_slug: planSlug,
        interval,
        coupon_code: coupon || undefined,
      }).then((d) => d.quote),
  })

const useList = <T>(key: string, url: string) =>
  useQuery({
    queryKey: ['membership', key],
    queryFn: () => get<unknown>(url).then((d) => asList<T>(d)),
  })

export const usePayments = () => useList<Payment>('payments', '/membership/me/payments')
export const useInvoices = () => useList<Invoice>('invoices', '/membership/me/invoices')
export const useLibrary = () => useList<LibraryItem>('library', '/membership/me/library')
export const useInvoice = (id: string) =>
  useQuery({
    queryKey: ['membership', 'invoice', id],
    queryFn: () => get<Invoice>(`/membership/me/invoices/${id}`),
  })

export const useAccess = (path: string) =>
  useQuery({
    queryKey: ['membership', 'access', path],
    retry: false,
    queryFn: () =>
      get<{ allowed: boolean; plan_required?: string }>('/membership/me/access', { path }),
  })

export const post = <T>(url: string, body?: unknown) =>
  api.post<{ data: T }>(url, body).then((r) => r.data.data)
export const put = <T>(url: string, body?: unknown) =>
  api.put<{ data: T }>(url, body).then((r) => r.data.data)
export const patch = <T>(url: string, body?: unknown) =>
  api.patch<{ data: T }>(url, body).then((r) => r.data.data)
export const del = (url: string) => api.delete(url)
