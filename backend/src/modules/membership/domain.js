// Pure membership rules: no database, no network. Money is integer paise everywhere.

const DAY = 86_400_000;
const IST_OFFSET_MS = 5.5 * 3_600_000;

// ---------- price / GST ----------

/** @returns {{subtotal:number, tax:number, total:number}} all paise. INCLUSIVE: amount already holds GST. */
export function calcPrice({ amount, gst_rate = 0, tax_mode = 'EXCLUSIVE' }) {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError('amount must be a non-negative integer (paise)');
  if (tax_mode === 'INCLUSIVE') {
    const subtotal = Math.round((amount * 100) / (100 + gst_rate));
    return { subtotal, tax: amount - subtotal, total: amount };
  }
  const tax = Math.round((amount * gst_rate) / 100);
  return { subtotal: amount, tax, total: amount + tax };
}

// ---------- coupons ----------

/** Paise taken off `amount` by a coupon (never more than the amount). */
export function couponDiscount({ discount_type, value }, amount) {
  const raw = discount_type === 'PERCENT' ? Math.round((amount * value) / 100) : value;
  return Math.max(0, Math.min(raw, amount));
}

/**
 * Why a coupon cannot be used now, or null when it can.
 * `redeemed` = open or paid uses of the code by anyone, `redeemedByMember` = by this member.
 */
export function couponProblem(c, { planSlug, now = new Date(), redeemed = 0, redeemedByMember = 0 }) {
  if (!c || !c.is_active) return 'This code is not valid';
  if (c.valid_from && now < c.valid_from) return 'This code is not active yet';
  if (c.valid_to && now > c.valid_to) return 'This code has expired';
  if (c.plan_slugs?.length && !c.plan_slugs.includes(planSlug)) return 'This code does not apply to this plan';
  if (c.max_redemptions != null && redeemed >= c.max_redemptions) return 'This code has been used up';
  if (redeemedByMember >= c.per_member_limit) return 'You have already used this code';
  return null;
}

/** GST part of a GST-inclusive total (used after a pro-rata credit is taken off the total). */
export const taxPortionOfTotal = (total, gst_rate) => total - Math.round((total * 100) / (100 + gst_rate));

// ---------- periods ----------

const MONTHS = { MONTHLY: 1, QUARTERLY: 3, HALF_YEARLY: 6, YEARLY: 12 };
export const INTERVAL_MONTHS = MONTHS;

/** End of a period starting at `start`; null for LIFETIME. Month-end safe (31 Jan + 1 month = 28/29 Feb). */
export function periodEnd(start, interval) {
  if (interval === 'LIFETIME') return null;
  const months = MONTHS[interval];
  if (!months) throw new RangeError(`unknown interval ${interval}`);
  const d = new Date(start);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

// ---------- status machine ----------

export const TRANSITIONS = {
  PENDING_PAYMENT: ['PENDING_APPROVAL', 'ACTIVE', 'TRIALING', 'CANCELLED'],
  PENDING_APPROVAL: ['ACTIVE', 'TRIALING', 'REJECTED', 'CANCELLED'],
  TRIALING: ['ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
  PAST_DUE: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED'],
  EXPIRED: ['ACTIVE'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  REJECTED: [],
};

export const canTransition = (from, to) => (TRANSITIONS[from] ?? []).includes(to);

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    const err = new Error(`Cannot change a subscription from ${from} to ${to}`);
    err.status = 409;
    throw err;
  }
}

/** A plan with no member types listed is open to everyone. */
export const allowsMemberType = (plan, type) => !plan.member_types?.length || plan.member_types.includes(type);

/** What a PAID first payment leads to. */
export const statusAfterPayment = (plan) => (plan.approval_mode === 'MANUAL' ? 'PENDING_APPROVAL' : 'ACTIVE');

/** Signup outcome: free plans skip payment. */
export function signupOutcome(plan) {
  // A trial starts without payment (after approval, for manual plans); the member pays before it ends.
  if (!plan.is_free && plan.trial_days > 0) return plan.approval_mode === 'MANUAL' ? { status: 'PENDING_APPROVAL', next: 'approval' } : { status: 'TRIALING', next: 'active' };
  if (!plan.is_free) return { status: 'PENDING_PAYMENT', next: 'checkout' };
  return plan.approval_mode === 'MANUAL'
    ? { status: 'PENDING_APPROVAL', next: 'approval' }
    : { status: 'ACTIVE', next: 'active' };
}

// Subscription that represents the member "now": a running one beats a pending one beats history.
const CURRENT_ORDER = ['ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'PENDING_APPROVAL', 'PENDING_PAYMENT', 'EXPIRED', 'CANCELLED', 'REJECTED'];
export function pickCurrentSubscription(subs) {
  return (
    [...subs].sort(
      (a, b) =>
        CURRENT_ORDER.indexOf(a.status) - CURRENT_ORDER.indexOf(b.status) ||
        new Date(b.created_at) - new Date(a.created_at)
    )[0] ?? null
  );
}

// ---------- pro-rata ----------

const wholeDays = (ms) => Math.max(0, Math.ceil(ms / DAY));

/** Unused part of what was paid, by days. Lifetime or expired subscriptions earn no credit. */
export function proRataCredit({ paid_total, starts_at, ends_at, now = new Date() }) {
  if (!ends_at || !starts_at || !paid_total) return 0;
  const total = wholeDays(new Date(ends_at) - new Date(starts_at));
  const left = Math.min(total, wholeDays(new Date(ends_at) - now));
  if (total === 0 || left === 0) return 0;
  return Math.round((paid_total * left) / total);
}

// ---------- numbering (the counters themselves live in sequences.js, inside a transaction) ----------

const pad = (n, w = 5) => String(n).padStart(w, '0');

/** Indian financial year, Apr to Mar, judged in IST: 2026-04-01 -> "2026-27". */
export function financialYear(date = new Date()) {
  const d = new Date(new Date(date).getTime() + IST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const start = d.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

export const invoiceNumber = (fy, seq, creditNote = false, prefix = 'MEM') => `${creditNote ? prefix + '-CN' : prefix}/${fy}/${pad(seq)}`;
export const memberNumber = (year, seq, prefix = 'KDL-M') => `${prefix}-${year}-${pad(seq)}`;
export const paymentReference = (seq) => `KDL-PAY-${pad(seq)}`;

// ---------- payment provider eligibility ----------

/**
 * Providers a member may see at checkout: PUBLISHED, plan allowed (none listed = all), member type
 * allowed (none listed = all), region and amount in range. Admin order.
 */
export function eligibleProviders(providers, { planId, memberType, region = 'INDIA', amount = 0 }) {
  return providers
    .filter((p) => {
      if (p.status !== 'PUBLISHED') return false;
      if (p.plans?.length && !p.plans.some((x) => (x.plan_id ?? x) === planId)) return false;
      if (p.member_types?.length && !p.member_types.includes(memberType)) return false;
      if (p.regions && p.regions !== 'ALL' && p.regions !== region) return false;
      if (p.min_amount != null && amount < p.min_amount) return false;
      if (p.max_amount != null && amount > p.max_amount) return false;
      return true;
    })
    .sort((a, b) => a.sort - b.sort);
}

// ---------- access rules ----------

const normPath = (p) => '/' + String(p ?? '').split('?')[0].replace(/^\/+|\/+$/g, '');
const globToRegex = (g) =>
  new RegExp('^' + g.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');

export function ruleMatches(rule, path) {
  const p = normPath(path);
  const v = normPath(rule.value);
  switch (rule.target) {
    case 'PAGE':
      return p === v || p === normPath('/p/' + rule.value);
    case 'URL_PATTERN':
      return globToRegex(v).test(p);
    default: // SECTION / MEDIA ids are matched as the last path segment
      return p.endsWith(v);
  }
}

/**
 * rules: every rule of every plan, each with `plan: {id, tier, slug, name}`.
 * A path no rule covers is open. A covered path is open to a plan whose tier reaches the lowest
 * tier that has a matching rule (Gold sees what Silver sees).
 */
export function checkAccess(rules, path, plan) {
  const hits = rules.filter((r) => ruleMatches(r, path));
  if (hits.length === 0) return { allowed: true };
  const lowest = hits.reduce((a, b) => (b.plan.tier < a.plan.tier ? b : a)).plan;
  if (plan && plan.tier >= lowest.tier) return { allowed: true };
  return { allowed: false, plan_required: { id: lowest.id, slug: lowest.slug, name: lowest.name, tier: lowest.tier } };
}

// ---------- daily expiry sweep decisions ----------

/** ACTIVE past ends_at -> PAST_DUE (grace); PAST_DUE past grace -> EXPIRED; cancel-at-period-end -> CANCELLED. */
export function sweepDecisions(subs, now = new Date(), graceDays = 7) {
  const out = [];
  for (const s of subs) {
    if (s.status === 'ACTIVE' && s.ends_at && new Date(s.ends_at) <= now) {
      if (s.cancel_at_period_end) out.push({ id: s.id, from: s.status, to: 'CANCELLED', data: { cancelled_at: now } });
      else
        out.push({
          id: s.id,
          from: s.status,
          to: 'PAST_DUE',
          data: { grace_ends_at: new Date(new Date(s.ends_at).getTime() + graceDays * DAY) },
        });
    } else if (s.status === 'TRIALING' && s.ends_at && new Date(s.ends_at) <= now) {
      // a trial that was not paid for ends without a grace period
      out.push({ id: s.id, from: s.status, to: s.cancel_at_period_end ? 'CANCELLED' : 'EXPIRED', data: s.cancel_at_period_end ? { cancelled_at: now } : {} });
    } else if (s.status === 'PAST_DUE' && s.grace_ends_at && new Date(s.grace_ends_at) <= now) {
      out.push({ id: s.id, from: s.status, to: 'EXPIRED', data: {} });
    }
  }
  return out;
}

// ---------- profile field validation ----------

const RX = {
  GSTIN: /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/,
  PAN: /^[A-Z]{5}\d{4}[A-Z]$/,
  PINCODE: /^[1-9]\d{5}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^\+?[0-9]{10,15}$/,
  URL: /^https?:\/\/\S+$/i,
};

/** @returns {Record<string,string>} errors by field key (empty = valid) */
export function validateFieldValues(fields, values) {
  const errors = {};
  for (const f of fields) {
    const v = values[f.key];
    const empty = v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (f.required) errors[f.key] = `${f.label} is required`;
      continue;
    }
    const text = f.type === 'GSTIN' || f.type === 'PAN' ? String(v).trim().toUpperCase() : String(v).trim();
    if (RX[f.type] && !RX[f.type].test(text))
      errors[f.key] = `${f.label} is not a valid ${f.type}`;
    else if (f.type === 'NUMBER' && Number.isNaN(Number(v))) errors[f.key] = `${f.label} must be a number`;
    else if (f.type === 'DATE' && Number.isNaN(Date.parse(v))) errors[f.key] = `${f.label} must be a date`;
    else if (f.type === 'SELECT' && Array.isArray(f.options) && f.options.length && !f.options.includes(v))
      errors[f.key] = `${f.label} must be one of the listed options`;
  }
  return errors;
}

/** Splits a field value into the typed value columns. */
export function toValueColumns(type, v) {
  const none = { value_text: null, value_num: null, value_date: null, value_bool: null, value_json: null };
  if (v === undefined || v === null || v === '') return none;
  if (type === 'NUMBER') return { ...none, value_num: Number(v) };
  if (type === 'DATE') return { ...none, value_date: new Date(v) };
  if (type === 'BOOLEAN') return { ...none, value_bool: v === true || v === 'true' };
  if (type === 'MULTISELECT' || type === 'FILE') return { ...none, value_json: v };
  return { ...none, value_text: type === 'GSTIN' || type === 'PAN' ? String(v).trim().toUpperCase() : String(v) };
}

export function fromValueColumns(row) {
  return row.value_text ?? row.value_num ?? row.value_date ?? row.value_bool ?? row.value_json ?? null;
}
