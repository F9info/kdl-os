import { z } from 'zod'

export const planSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes'),
  description: z.string().max(500).optional(),
  tier: z.number().int().min(1),
  color: z.string().optional(),
  is_free: z.boolean(),
  approval_mode: z.enum(['AUTO', 'MANUAL']),
  visibility: z.enum(['PUBLIC', 'HIDDEN', 'ARCHIVED']),
  trial_days: z.number().int().min(0),
  max_contacts: z.number().int().min(0).max(5),
  is_featured: z.boolean(),
  member_types: z.array(z.enum(['INDIVIDUAL', 'ORGANISATION'])).min(1, 'Pick at least one'),
  badge: z.string().max(40).optional().nullable(),
  seat_limit: z.number().int().min(1).optional().nullable(),
  allow_self_cancel: z.boolean().optional(),
  allow_plan_change: z.boolean().optional(),
})
export type PlanFormData = z.infer<typeof planSchema>

export const priceSchema = z.object({
  interval: z.enum(['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME']),
  amount: z.number().min(0, 'Enter an amount'),
  gst_rate: z.number().int().min(0).max(28),
  tax_mode: z.enum(['INCLUSIVE', 'EXCLUSIVE']),
})
export type PriceFormData = z.infer<typeof priceSchema>

export const memberSchema = z
  .object({
    member_type: z.enum(['INDIVIDUAL', 'ORGANISATION']),
    full_name: z.string().min(1, 'Name is required'),
    email: z.string().email('Valid email required'),
    mobile: z.string().optional(),
    legal_name: z.string().optional(),
    gstin: z.string().optional(),
    plan_id: z.string().optional(),
    complimentary: z.boolean(),
  })
  .refine((v) => v.member_type === 'INDIVIDUAL' || Boolean(v.legal_name), {
    path: ['legal_name'],
    message: 'Company name is required',
  })
export type MemberFormData = z.infer<typeof memberSchema>

export const contactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email required').or(z.literal('')),
  mobile: z.string().optional(),
  designation: z.string().optional(),
  access: z.enum(['FULL', 'CONTENT', 'BILLING']),
  is_primary: z.boolean(),
})
export type ContactFormData = z.infer<typeof contactSchema>

export const providerSchema = z.object({
  provider: z.string().min(1),
  label: z.string().min(1, 'Label is required'),
  description: z.string().optional(),
  mode: z.enum(['TEST', 'LIVE']),
  currency: z.string().min(3).max(3),
  regions: z.enum(['INDIA', 'OUTSIDE_INDIA', 'ALL']),
  is_default: z.boolean(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  member_types: z.array(z.enum(['INDIVIDUAL', 'ORGANISATION'])),
  // Write-only. Empty = keep what is stored.
  key_id: z.string().optional(),
  key_secret: z.string().optional(),
  webhook_secret: z.string().optional(),
  options: z.record(z.string(), z.boolean()),
  plan_ids: z.array(z.string()),
  manual_config: z.record(z.string(), z.string()),
})
export type ProviderFormData = z.infer<typeof providerSchema>

export const groupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  key: z
    .string()
    .min(1, 'Key is required')
    .regex(/^[a-z0-9_]+$/, 'Lowercase, numbers, underscore'),
  applies_to: z.enum(['INDIVIDUAL', 'ORGANISATION', 'BOTH']),
  ask_at_signup: z.boolean(),
  member_editable: z.boolean(),
  requires_review: z.boolean(),
})
export type GroupFormData = z.infer<typeof groupSchema>

export const fieldSchema = z.object({
  label: z.string().min(1, 'Label is required'),
  key: z
    .string()
    .min(1, 'Key is required')
    .regex(/^[a-z0-9_]+$/, 'Lowercase, numbers, underscore'),
  type: z.string().min(1),
  options: z.string().optional(), // comma separated, SELECT / MULTISELECT
  required: z.boolean(),
  is_unique: z.boolean(),
  visibility: z.enum(['EDIT', 'VIEW', 'HIDDEN']),
})
export type FieldFormData = z.infer<typeof fieldSchema>

export const settingsSchema = z.object({
  member_no_prefix: z.string().min(1),
  invoice_prefix: z.string().min(1),
  gst_rate_default: z.number().int().min(0).max(28),
  grace_days: z.number().int().min(0),
  renewal_rules: z.string().optional(),
  policies: z.string().optional(),
  primary_login: z.enum(['MOBILE_OTP', 'EMAIL']),
  allow_email_password: z.boolean(),
  require_approval_default: z.boolean(),
  member_types: z.array(z.enum(['INDIVIDUAL', 'ORGANISATION'])).min(1),
})
export type SettingsFormData = z.infer<typeof settingsSchema>
