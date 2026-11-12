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
// http(s) URL or same-origin path only: blocks javascript:/data: URLs rendered as href/src (stored XSS)
const optUrl = (max = 500) =>
  z.string().trim().max(max).refine((u) => /^https?:\/\/[^\s]+$/i.test(u) || /^\/(?!\/)[^\s]*$/.test(u), 'must be an http(s) URL or a relative path').optional().nullable();
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
    password: z.string().min(8).max(128).optional(), // optional when verification_token proves the mobile (OTP sign-up)
    verification_token: z.string().max(2000).optional(),
    whatsapp_opt_in: z.boolean().optional(),
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
    photo_url: optUrl(500),
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
  query: z.object({ plan_slug: str(), interval: interval.optional(), coupon_code: z.string().trim().max(40).optional() }),
});
export const checkoutSchema = S({
  body: z.object({
    plan_slug: str(),
    interval: interval,
    provider_id: z.string().optional(),
    provider_option: optStr(50),
    coupon_code: z.string().trim().max(40).optional(),
  }),
});
export const offlineProofSchema = withId(
  z.object({ utr: str(60), proof_url: optUrl(500), note: optStr(500) })
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
  badge: optStr(40),
  seat_limit: z.number().int().min(1).nullable().optional(),
  allow_self_cancel: z.boolean().optional(),
  allow_plan_change: z.boolean().optional(),
  role_on_activation: optStr(100),
  show_badge_on_profile: z.boolean().optional(),
  grace_access: z.boolean().optional(),
  status: z.enum(['DRAFT', 'ACTIVE']).optional(),
});
const priceBody = z.object({
  interval,
  amount: paise,
  currency: z.string().length(3).toUpperCase().optional(),
  gst_rate: z.number().int().min(0).max(40).optional(),
  tax_mode: z.enum(E.taxMode).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional(),
  sac_code: optStr(10),
});
export const planListSchema = listQuery({ visibility: z.enum(E.visibility).optional() });
export const planOrderSchema = S({ body: z.object({ ids: z.array(z.string()).min(1).max(100) }) });
export const planArchiveSchema = withId(z.object({ notify_members: z.boolean().optional() }).optional().default({}));
export const planCreateSchema = S({
  body: planBody.extend({
    prices: z.array(priceBody).optional(),
    benefits: z.array(z.object({ text: str(300), description: optStr(300), highlighted: z.boolean().optional() })).optional(),
  }),
});
export const planUpdateSchema = withId(planBody.partial());
export const priceCreateSchema = withId(priceBody);
export const priceUpdateSchema = withId(priceBody.partial());
export const benefitsSchema = withId(z.array(z.object({ text: str(300), description: optStr(300), highlighted: z.boolean().optional() })).max(50));
export const planFieldGroupsSchema = withId(
  z.array(z.object({ group_id: z.string(), member_type: memberType, required: z.boolean().optional() }))
);
export const planAccessRulesSchema = withId(
  z.array(z.object({ target: z.enum(E.accessTarget), value: str(300), label: optStr(200), non_member_view: z.enum(['EXCERPT_CTA', 'BLUR', 'HIDDEN']).optional(), enabled: z.boolean().optional() })).max(500)
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
  city: z.string().trim().max(100).optional(),
  fields: z.record(z.string(), z.string().max(200)).optional(), // answers of field packs: fields[industry]=Manufacturing
};
export const memberListSchema = listQuery(memberFilters);
export const memberCreateSchema = S({
  body: z.object({
    ...memberCore,
    email: z.string().trim().toLowerCase().email().max(200).optional(), // optional when a mobile is given
    payment: z.object({ mode: z.enum(['OFFLINE', 'PAY_LINK', 'COMPLIMENTARY']), method: optStr(40), reference: optStr(100), amount: paise.optional() }).optional(),
    send_welcome: z.boolean().optional(),
    issue_invoice: z.boolean().optional(),
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
  z.object({ days: z.number().int().min(1).max(3650).optional(), until: date.optional(), reason: optStr(500), notify: z.boolean().optional() }).refine((b) => b.days || b.until, 'days or until is required')
);
export const adminChangePlanSchema = withId(
  z.object({ plan_id: z.string().optional(), plan_slug: z.string().optional(), interval, apply: z.enum(['now', 'renewal']).optional(), settlement: z.enum(['pay_link', 'offline', 'waive']).optional() }).refine((b) => b.plan_id || b.plan_slug, 'plan_id or plan_slug is required')
);
export const reasonSchema = withId(z.object({ reason: optStr(500), until: date.optional().nullable(), pause_clock: z.boolean().optional(), notify: z.boolean().optional() }));
export const adminCancelSchema = withId(z.object({ reason: optStr(500), immediately: z.boolean().optional(), refund: z.enum(['none', 'pro_rata', 'full']).optional(), notify: z.boolean().optional() }));
export const recordPaymentSchema = withId(
  z.object({
    amount: paise.optional(),
    method: z.enum(['BANK_TRANSFER', 'CHEQUE', 'CASH', 'UPI', 'OTHER']).optional(),
    utr: optStr(60),
    note: optStr(500),
    plan_id: z.string().optional(),
    interval: interval.optional(),
    purpose: optStr(40),
    paid_on: date.optional(),
    issue_invoice: z.boolean().optional(),
    notify: z.boolean().optional(),
  })
);
export const notesSchema = withId(z.object({ notes: z.string().max(5000) }));
export const adminContactParams = S({ params: z.object({ id: z.string(), cid: z.string() }) });
export const adminContactCreate = withId(contactBody);
export const adminContactUpdate = S({ params: z.object({ id: z.string(), cid: z.string() }), body: contactBody.partial() });
export const bulkSchema = S({
  body: z.object({
    ids: z.array(z.string()).min(1).max(1000),
    action: z.enum(['tag', 'change-plan', 'export', 'send-email', 'send-renewal-link', 'suspend']),
    subject: optStr(200),
    message: optStr(5000),
    reason: optStr(500),
    tags: z.array(str(40)).optional(),
    remove: z.boolean().optional(),
    plan_id: z.string().optional(),
    interval: interval.optional(),
  }),
});
export const exportSchema = S({ query: z.object({ format: z.enum(['csv', 'xlsx']).default('csv'), columns: z.string().max(300).optional(), ids: z.string().optional(), ...page, ...memberFilters }) });

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
export const paymentListSchema = listQuery({ from: date.optional(), to: date.optional(), status: z.enum(E.payStatus).optional(), provider_id: z.string().optional(), member_id: z.string().optional() });
export const paymentRejectSchema = withId(z.object({ reason: str(500) }));
export const paymentRefundSchema = withId(z.object({ amount: paise.optional() }));
export const invoiceListSchema = listQuery({ from: date.optional(), to: date.optional(), member_id: z.string().optional(), kind: z.enum(['invoice', 'credit_note']).optional(), fy: z.string().optional() });
export const invoiceVoidSchema = withId(z.object({ reason: str(500) }));

// ----- payment providers -----
const providerBody = z.object({
  provider: z.string().trim().toUpperCase().regex(/^[A-Z_]+$/).max(30),
  type: z.enum(['GATEWAY', 'MANUAL']).optional(),
  label: str(100),
  description: optStr(500),
  logo_url: optUrl(500),
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

// ----- members: segments -----
export const segmentSchema = S({ body: z.object({ name: str(100), filters: z.record(z.string(), z.any()).default({}) }) });

// ----- auth (public + member) -----
export const otpSendSchema = S({ body: z.object({ mobile: z.string().trim().min(8).max(20), purpose: z.enum(['login', 'signup']).default('login') }) });
export const otpVerifySchema = S({ body: z.object({ mobile: z.string().trim().min(8).max(20), code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'), purpose: z.enum(['login', 'signup']).optional() }) });
export const oauthStartSchema = S({ params: z.object({ provider: z.string().min(1).max(40) }), query: z.object({ redirect: z.string().max(300).optional() }) });
export const linkSchema = S({ body: z.object({ provider: z.string().max(40).optional(), password: z.string().min(1).max(128), link_token: z.string().max(2000).optional() }) });
export const identityParams = S({ params: id });

// ----- admin: auth providers (A4 payload: config{...} holds the connection fields) -----
const providerConfig = z.object({
  client_id: z.string().max(300).optional(),
  client_secret: z.string().max(5000).optional(), // blank = keep
  discovery_url: optUrl(500),
  authorize_url: optUrl(500),
  token_url: optUrl(500),
  userinfo_url: optUrl(500),
  scopes: z.string().max(300).optional(),
  claim_map: z.record(z.string(), z.string()).optional(),
  team_id: z.string().max(40).optional(),
  key_id: z.string().max(40).optional(),
});
const authProviderBody = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/).max(30).optional(),
  preset: z.string().max(30).optional(),
  type: z.enum(['OIDC', 'OAUTH2', 'OTP', 'BUILT_IN', 'PRESET', 'OIDC_CUSTOM', 'OAUTH2_CUSTOM']).optional(),
  label: str(60).optional(),
  button_text: optStr(80),
  icon: optStr(300),
  color: optStr(20),
  enabled: z.boolean().optional(),
  trust_email: z.boolean().optional(),
  auto_link: z.boolean().optional(),
  config: providerConfig.optional(),
});
export const authProviderCreateSchema = S({ body: authProviderBody.extend({ label: str(60) }) });
export const authProviderUpdateSchema = S({ params: z.object({ key: z.string() }), body: authProviderBody });
export const authProviderKeyParams = S({ params: z.object({ key: z.string() }) });
export const authProviderReorderSchema = S({ body: z.object({ keys: z.array(z.string()).min(1).max(50) }) });

// ----- communication -----
const channel = z.enum(['IN_APP', 'WHATSAPP', 'EMAIL', 'SMS']);
const lang = z.enum(['en', 'te', 'hi']);
export const commEventSwitchSchema = S({ params: z.object({ key: z.string() }), body: z.object({ channel, enabled: z.boolean() }) });
export const commEventCreateSchema = S({ body: z.object({ key: z.string().trim().toLowerCase().regex(/^[a-z_]+\.[a-z_]+$/, 'like thing.happened').max(60), name: str(120), description: optStr(300), group_key: z.string().max(2).optional(), category: z.enum(['transactional', 'payment', 'security']).optional() }) });
export const commTemplateListSchema = listQuery({ group: z.string().max(2).optional(), channel: channel.optional(), lang: lang.optional() });
export const commTemplateParams = S({ params: z.object({ event: z.string(), channel, lang }) });
export const commTemplatePutSchema = S({
  params: z.object({ event: z.string(), channel, lang }),
  body: z.object({
    title: z.string().max(300).optional().nullable(), subject: z.string().max(300).optional().nullable(),
    body: z.string().max(60000).optional(), message: z.string().max(5000).optional(),
    preheader: optStr(300), link_url: optStr(300), link: optStr(300), icon: optStr(40), toast: z.boolean().optional(),
    enabled: z.boolean().optional(), is_active: z.boolean().optional(), attachments: z.array(z.string().max(40)).max(5).optional(),
    wa_template_name: optStr(120), wa_category: optStr(40), wa_status: optStr(40), wa_params: z.array(z.string()).optional(),
    wa_fields: z.record(z.string(), z.string()).optional(), wa_button_label: optStr(40), wa_button_url: optStr(300),
    from: optStr(200), reply_to: optStr(200),
  }).refine((b) => b.body !== undefined || b.message !== undefined, 'body (or message) is required'),
});
export const commTestSchema = S({ params: z.object({ event: z.string(), channel, lang }), body: z.object({ to: z.string().trim().max(200).optional() }) });
export const commVariablesSchema = S({ query: z.object({ event: z.string().optional() }) });
export const commLogListSchema = listQuery({ event: z.string().optional(), channel: channel.optional(), status: z.enum(['PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'CANCELLED']).optional(), member_id: z.string().optional(), from: date.optional(), to: date.optional() });
export const commRemindersSchema = S({
  body: z.object({
    steps: z.array(z.object({
      days_before: z.number().int().min(-60).max(365).optional(), offset_days: z.number().int().min(-60).max(365).optional(),
      in_app: z.boolean().optional(), whatsapp: z.boolean().optional(), email: z.boolean().optional(),
      channels: z.object({ IN_APP: z.boolean().optional(), WHATSAPP: z.boolean().optional(), EMAIL: z.boolean().optional() }).optional(), template: z.string().optional(),
    })).min(1).max(12).optional(),
    rules: z.object({ send_at: z.string().regex(/^\d{2}:\d{2}$/).optional(), timezone: z.string().max(40).optional(), skip_if_renewed: z.boolean().optional(), skip_auto_renew: z.boolean().optional(), quiet_hours: z.any().optional() }).optional(),
    send_at: z.string().regex(/^\d{2}:\d{2}$/).optional(), timezone: z.string().max(40).optional(), skip_if_renewed: z.boolean().optional(), skip_auto_renew: z.boolean().optional(),
  }),
});
export const commSettingsSchema = S({ body: z.record(z.string(), z.any()) });
export const commSettingsTestSchema = S({ params: z.object({ channel: z.enum(['whatsapp', 'email', 'sms']) }), body: z.object({ to: z.string().max(200).optional() }).optional() });

// ----- member communication -----
export const notificationListSchema = S({ query: z.object({ page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(), unread: z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean()).optional() }) });
export const notificationReadSchema = S({ body: z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }).refine((b) => b.all || b.ids?.length, 'ids or all is required') });
export const commPrefsSchema = S({ body: z.object({ preferences: z.record(z.string(), z.record(z.string(), z.boolean())).optional(), categories: z.record(z.string(), z.record(z.string(), z.boolean())).optional(), language: z.string().max(5).optional() }) });
export const autoRenewSchema = S({ body: z.object({ enabled: z.boolean() }) });

const couponBody = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9_-]+$/, 'Letters, numbers, - and _ only'),
  description: optStr(200),
  discount_type: z.enum(['PERCENT', 'FIXED']),
  value: z.number().int().min(1).max(2_000_000_000),
  plan_slugs: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  max_redemptions: z.number().int().min(1).nullable().optional(),
  per_member_limit: z.number().int().min(1).max(1000).default(1),
  valid_from: z.coerce.date().nullable().optional(),
  valid_to: z.coerce.date().nullable().optional(),
  is_active: z.boolean().default(true),
});
const couponRules = (b) => b.discount_type !== 'PERCENT' || b.value <= 100;
export const couponCreateSchema = S({ body: couponBody.refine(couponRules, { message: 'A percentage cannot be more than 100', path: ['value'] }) });
export const couponUpdateSchema = S({ params: id, body: couponBody.partial() });
export const couponListSchema = listQuery({ active: z.enum(['true', 'false']).optional() });
