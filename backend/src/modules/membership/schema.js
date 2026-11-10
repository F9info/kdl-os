import { z } from 'zod';

// validate() parses { body, query, params }; every export below is one route's schema.
const S = ({ body, query, params } = {}) =>
  z.object({ body: body ?? z.any(), query: query ?? z.any(), params: params ?? z.any() });

const E = {
  memberType: ['INDIVIDUAL', 'ORGANISATION'],
  interval: ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY', 'LIFETIME'],
  approval: ['AUTO', 'MANUAL'],
  visibility: ['PUBLIC', 'HIDDEN', 'ARCHIVED'],
  taxMode: ['INCLUSIVE', 'EXCLUSIVE'],
  subStatus: ['PENDING_PAYMENT', 'PENDING_APPROVAL', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUSPENDED', 'REJECTED'],
  payStatus: ['PENDING', 'AWAITING_PROOF', 'UNDER_VERIFICATION', 'PAID', 'FAILED', 'REFUNDED', 'REJECTED'],
  accessTarget: ['PAGE', 'SECTION', 'MEDIA', 'URL_PATTERN'],
  contactAccess: ['FULL', 'CONTENT', 'BILLING'],
  fieldType: ['TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'SELECT', 'MULTISELECT', 'BOOLEAN', 'EMAIL', 'PHONE', 'URL', 'GSTIN', 'PAN', 'FILE', 'PINCODE'],
};

const memberType = z.enum(E.memberType);
const interval = z.enum(E.interval);
const id = z.object({ id: z.string().min(1) });
const paise = z.number().int().min(0).max(2_000_000_000);
const str = (max = 200) => z.string().trim().min(1).max(max);
const optStr = (max = 500) => z.string().trim().max(max).optional().nullable();
const date = z.coerce.date();
const gstin = z.string().trim().toUpperCase().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, 'Invalid GSTIN');
const pan = z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN');
const mobile = z.string().trim().regex(/^\+?[0-9]{10,15}$/, 'Invalid mobile number');
const fieldValues = z.record(z.string(), z.any());
const page = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.string().max(40).optional(),
};
const listQuery = (extra = {}) => S({ query: z.object({ ...page, ...extra }) });
const idParams = S({ params: id });
const withId = (body) => S({ params: id, body });

// ----- public -----
export const joinFormSchema = S({
  params: z.object({ planSlug: z.string().min(1) }),
  query: z.object({ member_type: memberType.optional() }),
});

export const signupSchema = S({
  body: z.object({
    plan_slug: str(),
    interval: interval.optional(),
    member_type: memberType.default('INDIVIDUAL'),
    full_name: str(120),
    email: z.string().trim().toLowerCase().email().max(200),
    mobile,
    password: z.string().min(8).max(128),
    legal_name: optStr(200),
    gstin: gstin.optional().nullable(),
    fields: fieldValues.optional(),
  }),
});

// ----- member area -----
export const profileSchema = S({
  body: z.object({
    full_name: str(120).optional(),
    mobile: mobile.optional(),
    dob: date.optional().nullable(),
    gender: optStr(30),
    city: optStr(100),
    state: optStr(100),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/, 'Invalid pincode').optional().nullable(),
    address: optStr(500),
    photo_url: optStr(500),
    legal_name: optStr(200),
    gstin: gstin.optional().nullable(),
    pan: pan.optional().nullable(),
    whatsapp_opt_in: z.boolean().optional(),
  }),
});
export const fieldsSchema = S({ body: fieldValues });

const contactBody = z.object({
  name: str(120),
  email: z.string().trim().email().optional().nullable(),
  mobile: mobile.optional().nullable(),
  designation: optStr(100),
  access: z.enum(E.contactAccess).optional(),
  is_primary: z.boolean().optional(),
});
export const contactCreateSchema = S({ body: contactBody });
export const contactUpdateSchema = S({ params: z.object({ id: z.string() }), body: contactBody.partial() });
export const contactParamSchema = S({ params: z.object({ id: z.string() }) });

export const checkoutProvidersSchema = S({
  query: z.object({ plan_slug: str(), interval: interval.optional() }),
});
export const checkoutSchema = S({
  body: z.object({
    plan_slug: str(),
    interval: interval,
    provider_id: z.string().optional(),
    provider_option: optStr(50),
  }),
});
export const offlineProofSchema = withId(
  z.object({ utr: str(60), proof_url: optStr(500), note: optStr(500) })
);
export const confirmSchema = withId(
  z.object({ razorpay_order_id: str(100), razorpay_payment_id: str(100), razorpay_signature: str(200) })
);
export const changePlanSchema = S({ body: z.object({ plan_slug: str(), interval }) });
export const cancelSchema = S({ body: z.object({ reason: optStr(500), immediately: z.boolean().optional() }) });
export const accessSchema = S({ query: z.object({ path: z.string().min(1).max(500) }) });

// ----- admin: plans -----
const planBody = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, 'lowercase letters, digits and hyphens').max(60),
  name: str(120),
  description: optStr(2000),
  tier: z.number().int().min(0).max(100).optional(),
  color: optStr(20),
  is_free: z.boolean().optional(),
  approval_mode: z.enum(E.approval).optional(),
  visibility: z.enum(E.visibility).optional(),
  trial_days: z.number().int().min(0).max(365).optional(),
  member_types: z.array(memberType).min(1).optional(),
  max_contacts: z.number().int().min(0).max(100).optional(),
  is_featured: z.boolean().optional(),
  sort: z.number().int().optional(),
});
const priceBody = z.object({
  interval,
  amount: paise,
  currency: z.string().length(3).toUpperCase().optional(),
  gst_rate: z.number().int().min(0).max(40).optional(),
  tax_mode: z.enum(E.taxMode).optional(),
  is_active: z.boolean().optional(),
});
export const planListSchema = listQuery({ visibility: z.enum(E.visibility).optional() });
export const planCreateSchema = S({
  body: planBody.extend({
    prices: z.array(priceBody).optional(),
    benefits: z.array(z.object({ text: str(300), highlighted: z.boolean().optional() })).optional(),
  }),
});
export const planUpdateSchema = withId(planBody.partial());
export const priceCreateSchema = withId(priceBody);
export const priceUpdateSchema = withId(priceBody.partial());
export const benefitsSchema = withId(z.array(z.object({ text: str(300), highlighted: z.boolean().optional() })).max(50));
export const planFieldGroupsSchema = withId(
  z.array(z.object({ group_id: z.string(), member_type: memberType, required: z.boolean().optional() }))
);
export const planAccessRulesSchema = withId(
  z.array(z.object({ target: z.enum(E.accessTarget), value: str(300), label: optStr(200) })).max(500)
);
export { idParams };

// ----- admin: members -----
const memberCore = {
  member_type: memberType,
  full_name: str(120),
  email: z.string().trim().toLowerCase().email().max(200),
  mobile: mobile.optional().nullable(),
  dob: date.optional().nullable(),
  gender: optStr(30),
  city: optStr(100),
  state: optStr(100),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/).optional().nullable(),
  address: optStr(500),
  legal_name: optStr(200),
  gstin: gstin.optional().nullable(),
  pan: pan.optional().nullable(),
  tags: z.array(str(40)).max(30).optional(),
  notes: optStr(5000),
};
const memberFilters = {
  status: z.enum(E.subStatus).optional(),
  plan_id: z.string().optional(),
  member_type: memberType.optional(),
  tag: z.string().optional(),
  member_since_from: date.optional(),
  member_since_to: date.optional(),
  valid_till_from: date.optional(),
  valid_till_to: date.optional(),
};
export const memberListSchema = listQuery(memberFilters);
export const memberCreateSchema = S({
  body: z.object({
    ...memberCore,
    member_type: memberType.default('INDIVIDUAL'),
    plan_id: z.string().optional(),
    plan_slug: z.string().optional(),
    interval: interval.optional(),
    complimentary: z.boolean().optional(),
    starts_at: date.optional(),
    fields: fieldValues.optional(),
    contacts: z.array(contactBody).max(10).optional(),
  }),
});
export const memberUpdateSchema = withId(z.object(memberCore).partial().extend({ fields: fieldValues.optional() }));
export const extendSchema = withId(
  z.object({ days: z.number().int().min(1).max(3650).optional(), until: date.optional() }).refine((b) => b.days || b.until, 'days or until is required')
);
export const adminChangePlanSchema = withId(
  z.object({ plan_id: z.string().optional(), plan_slug: z.string().optional(), interval }).refine((b) => b.plan_id || b.plan_slug, 'plan_id or plan_slug is required')
);
export const reasonSchema = withId(z.object({ reason: optStr(500) }));
export const adminCancelSchema = withId(z.object({ reason: optStr(500), immediately: z.boolean().optional() }));
export const recordPaymentSchema = withId(
  z.object({
    amount: paise.optional(),
    method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'OTHER']).optional(),
    utr: optStr(60),
    note: optStr(500),
    plan_id: z.string().optional(),
    interval: interval.optional(),
  })
);
export const notesSchema = withId(z.object({ notes: z.string().max(5000) }));
export const adminContactParams = S({ params: z.object({ id: z.string(), cid: z.string() }) });
export const adminContactCreate = withId(contactBody);
export const adminContactUpdate = S({ params: z.object({ id: z.string(), cid: z.string() }), body: contactBody.partial() });
export const bulkSchema = S({
  body: z.object({
    ids: z.array(z.string()).min(1).max(1000),
    action: z.enum(['tag', 'change-plan', 'export']),
    tags: z.array(str(40)).optional(),
    remove: z.boolean().optional(),
    plan_id: z.string().optional(),
    interval: interval.optional(),
  }),
});
export const exportSchema = S({ query: z.object({ format: z.enum(['csv']).default('csv'), ids: z.string().optional(), ...page, ...memberFilters }) });

const importBody = z.object({
  rows: z.array(z.record(z.string(), z.any())).min(1).max(5000),
  mapping: z.record(z.string(), z.string()), // CSV column -> member field
  plan_slug: z.string().optional(),
  member_type: memberType.optional(),
});
export const importSchema = S({ body: importBody });

// ----- approvals / payments / invoices -----
export const approvalListSchema = listQuery();
export const approvalParamSchema = S({ params: z.object({ subscriptionId: z.string() }) });
export const approvalRejectSchema = S({
  params: z.object({ subscriptionId: z.string() }),
  body: z.object({ reason: str(500), message: optStr(1000), refund: z.boolean().optional() }),
});
export const paymentListSchema = listQuery({ status: z.enum(E.payStatus).optional(), provider_id: z.string().optional(), member_id: z.string().optional() });
export const paymentRejectSchema = withId(z.object({ reason: str(500) }));
export const paymentRefundSchema = withId(z.object({ amount: paise.optional() }));
export const invoiceListSchema = listQuery({ member_id: z.string().optional(), kind: z.enum(['invoice', 'credit_note']).optional(), fy: z.string().optional() });
export const invoiceVoidSchema = withId(z.object({ reason: str(500) }));

// ----- payment providers -----
const providerBody = z.object({
  provider: z.string().trim().toUpperCase().regex(/^[A-Z_]+$/).max(30),
  type: z.enum(['GATEWAY', 'MANUAL']).optional(),
  label: str(100),
  description: optStr(500),
  logo_url: optStr(500),
  sort: z.number().int().optional(),
  is_default: z.boolean().optional(),
  mode: z.enum(['TEST', 'LIVE']).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  credentials: z.record(z.string(), z.string()).optional(), // write-only
  webhook_secret: z.string().max(200).optional(), // write-only
  options: z.record(z.string(), z.any()).optional(),
  member_types: z.array(memberType).optional(),
  regions: z.enum(['INDIA', 'OUTSIDE_INDIA', 'ALL']).optional(),
  min_amount: paise.optional().nullable(),
  max_amount: paise.optional().nullable(),
  manual_config: z.record(z.string(), z.any()).optional(),
  plan_ids: z.array(z.string()).optional(),
});
export const providerCreateSchema = S({ body: providerBody });
export const providerUpdateSchema = withId(providerBody.partial());
export const providerOrderSchema = S({ body: z.object({ ids: z.array(z.string()).min(1) }) });
export const providerListSchema = listQuery({ status: z.enum(['DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED']).optional() });

// ----- field packs -----
const groupBody = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).max(40),
  name: str(100),
  icon: optStr(40),
  applies_to: z.enum(['INDIVIDUAL', 'ORGANISATION', 'BOTH']).optional(),
  ask_at_signup: z.boolean().optional(),
  member_editable: z.boolean().optional(),
  requires_review: z.boolean().optional(),
  sort: z.number().int().optional(),
  is_active: z.boolean().optional(),
});
const fieldBody = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).max(40),
  label: str(120),
  type: z.enum(E.fieldType),
  options: z.array(z.string()).optional(),
  validation: z.record(z.string(), z.any()).optional(),
  show_when: z.record(z.string(), z.any()).optional().nullable(),
  visibility: z.enum(['EDIT', 'VIEW', 'HIDDEN']).optional(),
  required: z.boolean().optional(),
  is_unique: z.boolean().optional(),
  sort: z.number().int().optional(),
});
export const groupCreateSchema = S({ body: groupBody.extend({ fields: z.array(fieldBody).optional() }) });
export const groupUpdateSchema = withId(groupBody.partial());
export const fieldCreateSchema = withId(fieldBody);
export const fieldUpdateSchema = withId(fieldBody.partial());
export const presetApplySchema = S({
  body: z.object({ preset: z.enum(['Business', 'Professional', 'Education', 'Community', 'Residential', 'Club', 'Documents']) }),
});

// ----- settings -----
export const settingsSchema = S({
  body: z.object({
    general: z
      .object({
        member_no_prefix: z.string().trim().max(20).optional(),
        invoice_prefix: z.string().trim().max(20).optional(),
        gst_rate_default: z.number().int().min(0).max(40).optional(),
        grace_days: z.number().int().min(0).max(90).optional(),
        renewal_rules: z.record(z.string(), z.any()).optional(),
        policies: z.record(z.string(), z.any()).optional(),
      })
      .optional(),
    signup: z
      .object({
        primary_login: z.enum(['MOBILE_OTP', 'EMAIL']).optional(),
        allow_email_password: z.boolean().optional(),
        require_approval_default: z.boolean().optional(),
        member_types: z.array(memberType).min(1).optional(),
      })
      .optional(),
  }),
});

// One mapped CSV row for member import. Phones may carry spaces or dashes in spreadsheets.
export const importRowSchema = z.object({
  full_name: str(120),
  email: z.string().trim().toLowerCase().email().max(200),
  mobile: z.preprocess((v) => (v ? String(v).replace(/[\s-]/g, '') : undefined), mobile.optional()),
  member_type: z.preprocess((v) => (v ? String(v).trim().toUpperCase() : undefined), memberType.default('INDIVIDUAL')),
  legal_name: optStr(200),
  gstin: z.preprocess((v) => v || undefined, gstin.optional()),
  pan: z.preprocess((v) => v || undefined, pan.optional()),
  city: optStr(100),
  state: optStr(100),
  pincode: z.preprocess((v) => v || undefined, z.string().trim().regex(/^[1-9]\d{5}$/).optional()),
  address: optStr(500),
  tags: z.preprocess((v) => (typeof v === 'string' ? v.split(/[;,|]/).map((t) => t.trim()).filter(Boolean) : v), z.array(str(40)).optional()),
  notes: optStr(5000),
});

export const memberActivitySchema = S({ params: id, query: z.object({ ...page }) });
