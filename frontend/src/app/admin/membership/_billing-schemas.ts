import { z } from 'zod'

/** Zod schemas for the Billing / Providers / Settings screens (kept apart from the shared _schemas.ts). */

export const manualPaymentSchema = z.object({
  member_id: z.string().min(1, 'Pick a member'),
  purpose: z.enum(['NEW', 'RENEWAL']),
  price_key: z.string().min(1, 'Pick a plan and price'), // `${planId}|${interval}`
  method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'OTHER']),
  paid_on: z.string().min(1, 'Date is required'),
  reference: z.string().max(60).optional(),
  collected_by: z.string().max(100).optional(),
  receipt_url: z.string().optional(),
  note: z.string().max(500).optional(),
  activate: z.boolean(),
  invoice: z.boolean(),
  email: z.boolean(),
})
export type ManualPaymentData = z.infer<typeof manualPaymentSchema>

export const providerFormSchema = z
  .object({
    provider: z.string().min(1),
    label: z.string().trim().min(1, 'Label is required').max(100),
    description: z.string().max(500).optional(),
    logo_url: z.string().optional(),
    is_default: z.boolean(),
    mode: z.enum(['TEST', 'LIVE']),
    currency: z.string().length(3),
    regions: z.enum(['INDIA', 'OUTSIDE_INDIA', 'ALL']),
    member_type: z.enum(['ALL', 'INDIVIDUAL', 'ORGANISATION']),
    min_amount: z.number().min(0).optional(),
    max_amount: z.number().min(0).optional(),
    // Write-only secrets. Empty = keep what is stored.
    key_id: z.string().optional(),
    key_secret: z.string().optional(),
    webhook_secret: z.string().optional(),
    options: z.record(z.string(), z.boolean()),
    plan_ids: z.array(z.string()),
    manual_config: z.record(z.string(), z.any()),
  })
  .refine((v) => v.min_amount == null || v.max_amount == null || v.max_amount >= v.min_amount, {
    path: ['max_amount'],
    message: 'Maximum must be at least the minimum',
  })
export type ProviderFormValues = z.infer<typeof providerFormSchema>

export const accessRuleSchema = z
  .object({
    target: z.enum(['PAGE', 'SECTION', 'MEDIA', 'URL_PATTERN']),
    value: z.string().trim().min(1, 'Say what to protect').max(300),
    label: z.string().max(200).optional(),
    who: z.enum(['ANY', 'PLANS', 'MIN_TIER']),
    plan_ids: z.array(z.string()),
    min_tier: z.number().int().min(0).optional(),
    allow_grace: z.boolean(),
    non_member_view: z.enum(['HIDDEN', 'BLUR', 'EXCERPT_CTA']),
    lock_title: z.string().max(120).optional(),
    lock_message: z.string().max(500).optional(),
    cta_label: z.string().max(60).optional(),
    cta_url: z
      .string()
      .max(300)
      .refine(
        (u) => !u || /^https?:\/\//i.test(u) || u.startsWith('/'),
        'Use an http(s) link or a /path'
      )
      .optional(),
  })
  .refine((v) => v.who !== 'PLANS' || v.plan_ids.length > 0, {
    path: ['plan_ids'],
    message: 'Pick at least one plan',
  })
export type AccessRuleData = z.infer<typeof accessRuleSchema>

const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
export const settingsGeneralSchema = z.object({
  member_no_prefix: z.string().trim().min(1, 'Required').max(20),
  invoice_prefix: z.string().trim().min(1, 'Required').max(20),
  legal_name: z.string().trim().max(200).optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === '' || GSTIN_RE.test(v), 'Invalid GSTIN')
    .optional(),
  state: z.string().max(100).optional(),
  gst_rate_default: z.number().int().min(0).max(40),
  sac: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'SAC is 4 to 8 digits')
    .or(z.literal(''))
    .optional(),
  currency: z.string().length(3),
  grace_days: z.number().int().min(0).max(90),
  renew_early_days: z.number().int().min(0).max(365),
  after_grace: z.enum(['EXPIRE_LOCK', 'DOWNGRADE_FREE', 'KEEP_ACCESS']),
  terms_url: z.string().max(300).optional(),
  refund_policy_url: z.string().max(300).optional(),
  cancel_policy: z.enum(['PERIOD_END', 'ANYTIME', 'NEVER']),
})
export type SettingsGeneralData = z.infer<typeof settingsGeneralSchema>

export const settingsSignupSchema = z.object({
  primary_login: z.enum(['MOBILE_OTP', 'EMAIL']),
  allow_email_password: z.boolean(),
  require_approval_default: z.boolean(),
  verify_email_code: z.boolean(),
  ask_mobile_after_social: z.boolean(),
  auto_link_social: z.boolean(),
  organisation_enabled: z.boolean(),
  max_contacts: z.number().int().min(1).max(100),
  primary_contact: z.enum(['REQUIRED_BILLING', 'REQUIRED', 'OPTIONAL']),
  verify_documents: z.boolean(),
})
export type SettingsSignupData = z.infer<typeof settingsSignupSchema>

export const packSchema = z.object({
  name: z.string().trim().min(1, 'Pack name is required').max(100),
  description: z.string().max(300).optional(),
  applies_to: z.enum(['INDIVIDUAL', 'ORGANISATION', 'BOTH']),
  ask_at_signup: z.boolean(),
  member_editable: z.boolean(),
  requires_review: z.boolean(),
  show_in_directory: z.boolean(),
  copy_from: z.string().optional(),
})
export type PackData = z.infer<typeof packSchema>

export const fieldFormSchema = z.object({
  label: z.string().trim().min(1, 'Label is required').max(120),
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .regex(/^[a-z0-9_]+$/, 'Lowercase letters, numbers and underscore only')
    .max(40),
  type: z.string().min(1),
  options: z.string().optional(), // one per line / comma separated
  help_text: z.string().max(300).optional(),
  show_when_key: z.string().optional(),
  show_when_value: z.string().optional(),
  visibility: z.enum(['EDIT', 'VIEW', 'HIDDEN']),
  required: z.boolean(),
  check_format: z.boolean(),
  lookup_name: z.boolean(),
  is_unique: z.boolean(),
})
export type FieldFormValues = z.infer<typeof fieldFormSchema>
