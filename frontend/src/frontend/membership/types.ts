// Shapes of docs/MEMBERSHIP_API_CONTRACT.md (public + member area). Money is integer paise.
export type MemberType = 'INDIVIDUAL' | 'ORGANISATION'
export type Interval = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY' | 'LIFETIME'

export interface PlanPrice {
  id: string
  interval: Interval
  amount: number
  currency: string
  gst_rate: number
  tax_mode: 'INCLUSIVE' | 'EXCLUSIVE'
}
export interface Benefit {
  id?: string
  text: string
  highlighted?: boolean
}
export interface Plan {
  id: string
  slug: string
  name: string
  description?: string | null
  tier?: number
  color?: string | null
  is_free: boolean
  approval_mode: 'AUTO' | 'MANUAL'
  is_featured?: boolean
  member_types?: MemberType[]
  max_contacts?: number
  prices: PlanPrice[]
  benefits: Benefit[]
}

export interface FormField {
  key: string
  label: string
  type: string
  options?: unknown
  required?: boolean
}
export interface FieldGroup {
  id?: string
  key: string
  name: string
  required?: boolean
  fields: FormField[]
}

export type SubscriptionStatus =
  | 'PENDING_PAYMENT'
  | 'PENDING_APPROVAL'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED'
  | 'REJECTED'

export interface Member {
  id: string
  member_no?: string | null
  member_type: MemberType
  full_name: string
  email: string
  mobile?: string | null
  dob?: string | null
  gender?: string | null
  city?: string | null
  state?: string | null
  pincode?: string | null
  address?: string | null
  legal_name?: string | null
  gstin?: string | null
  member_since?: string | null
}
export interface Subscription {
  id: string
  status: SubscriptionStatus
  starts_at?: string | null
  ends_at?: string | null
  grace_ends_at?: string | null
  cancel_at_period_end?: boolean
  rejected_reason?: string | null
  pending_plan_id?: string | null
  price?: PlanPrice | null
}
export interface Contact {
  id: string
  name: string
  email?: string | null
  mobile?: string | null
  designation?: string | null
  access?: 'FULL' | 'CONTENT' | 'BILLING'
  is_primary?: boolean
}
export interface MeData {
  member: Member
  subscription: Subscription | null
  plan: Plan | null
  contacts: Contact[]
  fields: Record<string, unknown>
}

export interface Provider {
  id: string
  provider: string
  type: 'GATEWAY' | 'MANUAL'
  label: string
  description?: string | null
  logo_url?: string | null
}
export interface Payment {
  id: string
  reference: string
  status: string
  amount: number
  currency: string
  created_at: string
  paid_at?: string | null
  utr?: string | null
  provider?: { label?: string } | null
}
export interface Invoice {
  id: string
  number: string
  description: string
  bill_to_name: string
  bill_to_gstin?: string | null
  bill_to_address?: string | null
  subtotal: number
  gst_rate: number
  tax_amount: number
  total: number
  is_credit_note?: boolean
  voided_at?: string | null
  issued_at: string
}
export interface LibraryItem {
  id: string
  title: string
  description?: string | null
  type?: string
  url?: string
}
