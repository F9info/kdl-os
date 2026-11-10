import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/axios'

/** Shared types + thin TanStack hooks for the Membership admin. Contract: docs/MEMBERSHIP_API_CONTRACT.md. */

export type Interval = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'LIFETIME'
export type MemberType = 'INDIVIDUAL' | 'ORGANISATION'
export type SubStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'REJECTED'
export type PaymentStatus =
  'PENDING' | 'AWAITING_PROOF' | 'UNDER_VERIFICATION' | 'PAID' | 'FAILED' | 'REFUNDED' | 'REJECTED'
export type ProviderStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED'
export type AccessTarget = 'PAGE' | 'SECTION' | 'MEDIA' | 'URL_PATTERN'

export interface Price {
  id: string
  plan_id: string
  interval: Interval
  amount: number
  currency: string
  gst_rate: number
  tax_mode: 'INCLUSIVE' | 'EXCLUSIVE'
  is_active: boolean
}
export interface Benefit {
  id?: string
  text: string
  highlighted: boolean
  sort?: number
}
export interface AccessRule {
  id?: string
  target: AccessTarget
  value: string
  label?: string | null
}
export interface PlanFieldGroup {
  group_id: string
  member_type: MemberType
  required: boolean
}
export interface Plan {
  id: string
  slug: string
  name: string
  description: string | null
  tier: number
  color: string | null
  is_free: boolean
  approval_mode: 'AUTO' | 'MANUAL'
  visibility: 'PUBLIC' | 'HIDDEN' | 'ARCHIVED'
  trial_days: number
  member_types: MemberType[]
  max_contacts: number
  is_featured: boolean
  sort: number
  prices?: Price[]
  benefits?: Benefit[]
  access_rules?: AccessRule[]
  field_groups?: PlanFieldGroup[]
  member_count?: number
  _count?: { subscriptions?: number }
}

export interface Subscription {
  id: string
  status: SubStatus
  starts_at: string | null
  ends_at: string | null
  plan_id: string
  plan?: Pick<Plan, 'id' | 'name' | 'slug'>
  price?: Pick<Price, 'interval' | 'amount'> | null
  auto_renew?: boolean
  suspended_reason?: string | null
  cancel_reason?: string | null
}
export interface Contact {
  id: string
  name: string
  email: string | null
  mobile: string | null
  designation: string | null
  access: 'FULL' | 'CONTENT' | 'BILLING'
  is_primary: boolean
}
export interface Member {
  id: string
  member_no: string | null
  member_type: MemberType
  full_name: string
  email: string
  mobile: string | null
  legal_name?: string | null
  gstin?: string | null
  pan?: string | null
  dob?: string | null
  gender?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  address?: string | null
  member_since: string | null
  tags: string[]
  notes?: string | null
  subscription?: Subscription | null
  plan?: { id?: string; name?: string } | null
  status?: string | null
  subscriptions?: Subscription[]
  lifetime_paid?: number
  contacts?: Contact[]
  fields?: Record<string, unknown>
}
export interface Payment {
  id: string
  reference: string
  status: PaymentStatus
  amount: number
  tax_amount: number
  currency: string
  utr?: string | null
  proof_url?: string | null
  note?: string | null
  failure_reason?: string | null
  refunded_amount: number
  paid_at: string | null
  created_at: string
  member?: Pick<Member, 'id' | 'full_name' | 'member_no' | 'email'>
  provider?: { id: string; label: string; provider: string } | null
  events?: Array<{ key: string; created_at: string }>
}
export interface Invoice {
  id: string
  number: string
  is_credit_note: boolean
  bill_to_name: string
  bill_to_gstin?: string | null
  bill_to_address?: string | null
  description: string
  subtotal: number
  gst_rate: number
  tax_amount: number
  total: number
  issued_at: string
  voided_at?: string | null
  void_reason?: string | null
}
export interface Provider {
  id: string
  provider: string
  type: 'GATEWAY' | 'MANUAL'
  label: string
  description: string | null
  status: ProviderStatus
  sort: number
  is_default: boolean
  mode: 'TEST' | 'LIVE'
  currency: string
  has_credentials: boolean
  has_webhook_secret?: boolean
  options: Record<string, boolean>
  member_types: MemberType[]
  regions: 'INDIA' | 'OUTSIDE_INDIA' | 'ALL'
  min_amount: number | null
  max_amount: number | null
  manual_config: Record<string, string | boolean | undefined>
  plan_ids?: string[]
  last_test_at?: string | null
  last_test_ok?: boolean | null
}
export interface FieldDef {
  id: string
  group_id: string
  key: string
  label: string
  type: string
  options: string[]
  required: boolean
  is_unique: boolean
  visibility: 'EDIT' | 'VIEW' | 'HIDDEN'
  sort: number
}
export interface FieldGroup {
  id: string
  key: string
  name: string
  applies_to: 'INDIVIDUAL' | 'ORGANISATION' | 'BOTH'
  ask_at_signup: boolean
  member_editable: boolean
  requires_review: boolean
  is_active: boolean
  fields?: FieldDef[]
}
export interface Settings {
  general: {
    member_no_prefix: string
    invoice_prefix: string
    gst_rate_default: number
    grace_days: number
    renewal_rules?: string
    policies?: string
  }
  signup: {
    primary_login: 'MOBILE_OTP' | 'EMAIL'
    allow_email_password: boolean
    require_approval_default: boolean
    member_types: MemberType[]
  }
}
export interface Overview {
  kpis: Record<string, number>
  growth: Array<{ month: string; count: number }>
  plan_mix: Array<{ plan: { id: string; name?: string }; count: number }>
  recent_members: Member[]
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export const FIELD_TYPES = [
  'TEXT',
  'TEXTAREA',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTISELECT',
  'BOOLEAN',
  'EMAIL',
  'PHONE',
  'URL',
  'GSTIN',
  'PAN',
  'FILE',
  'PINCODE',
] as const

const root = '/membership/admin'
const KEY = 'membership'

export type Params = Record<string, string | number | undefined>
const clean = (p?: Params) =>
  Object.fromEntries(Object.entries(p ?? {}).filter(([, v]) => v !== '' && v !== undefined))

export function useAdminList<T>(resource: string, params?: Params) {
  return useQuery({
    queryKey: [KEY, resource, params],
    queryFn: () =>
      api.get(`${root}/${resource}`, { params: clean(params) }).then((r) => {
        const d = r.data.data
        return (
          Array.isArray(d) ? { items: d, total: d.length, page: 1, limit: d.length } : d
        ) as Page<T>
      }),
    placeholderData: keepPreviousData,
  })
}

export function useAdminItem<T>(path: string | null) {
  return useQuery({
    queryKey: [KEY, path],
    queryFn: () => api.get(`${root}/${path}`).then((r) => r.data.data as T),
    enabled: Boolean(path),
  })
}

export interface ActionInput {
  method?: 'post' | 'put' | 'patch' | 'delete'
  path: string
  data?: unknown
}

/** One mutation for every admin write; any success refetches all membership queries. */
export function useAdminAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ method = 'post', path, data }: ActionInput) =>
      api.request({ method, url: `${root}/${path}`, data }).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export const usePlans = (params?: Params) => useAdminList<Plan>('plans', params)
export const usePlan = (id: string | null) => useAdminItem<Plan>(id ? `plans/${id}` : null)
export const useMembers = (params?: Params) => useAdminList<Member>('members', params)
export const useMember = (id: string | null) => useAdminItem<Member>(id ? `members/${id}` : null)
export const usePayments = (params?: Params) => useAdminList<Payment>('payments', params)
export const useInvoices = (params?: Params) => useAdminList<Invoice>('invoices', params)
export const useProviders = () => useAdminList<Provider>('payment-providers')
export const useFieldGroups = () => useAdminList<FieldGroup>('field-groups')
export const useOverview = () => useAdminItem<Overview>('overview')
export const useSettings = () => useAdminItem<Settings>('settings')

export const rupees = (paise: number | null | undefined) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format((paise ?? 0) / 100)
export const toPaise = (rupeesValue: number) => Math.round(rupeesValue * 100)
