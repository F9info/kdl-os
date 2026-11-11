// Strict template rendering and the shared variable set. Pure: no database, no network.

const IST = 'Asia/Kolkata';

/** {{var}} -> value. Anything unresolved is returned in `missing` and the caller must NOT send. */
export function renderStrict(text, vars = {}, { html = false } = {}) {
  const missing = new Set();
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const out = String(text ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = vars[k];
    if (v === undefined || v === null || v === '') {
      missing.add(k);
      return '';
    }
    return html ? esc(v) : String(v);
  });
  return { text: out, missing: [...missing] };
}

export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: IST }) : '—');
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: IST }) : '—');
const SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
export const fmtMoney = (paise, currency = 'INR') => `${SYMBOL[currency] ?? currency + ' '}${(Number(paise ?? 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const cap = (s) => String(s ?? '').toLowerCase().replace(/(^|_)([a-z])/g, (_, a, b) => (a ? ' ' : '') + b.toUpperCase());

/** Calendar days from `from` to `to` in IST (whole days, may be negative). */
export function istDayDiff(to, from = new Date()) {
  const day = (d) => Math.floor((new Date(d).getTime() + 5.5 * 3_600_000) / 86_400_000);
  return day(to) - day(from);
}

export function daysLeftText(n) {
  if (n > 1) return `in ${n} days`;
  if (n === 1) return 'tomorrow';
  if (n === 0) return 'today';
  return n === -1 ? 'yesterday' : `${-n} days ago`;
}

/** E.164 for display, storage and WhatsApp. 10 digits get the default country code; null when it cannot be valid. */
export function toE164(raw, defaultCc = '+91') {
  if (!raw) return null;
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (!s.startsWith('+')) {
    if (!/^\d+$/.test(s)) return null;
    s = s.length === 10 ? defaultCc + s : s.length === 11 && s.startsWith('0') ? defaultCc + s.slice(1) : s.length === 12 && s.startsWith(defaultCc.slice(1)) ? '+' + s : null;
    if (!s) return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(s) && (!s.startsWith('+91') || /^\+91[6-9]\d{9}$/.test(s)) ? s : null;
}

export const maskContact = (v) => {
  if (!v) return null;
  const s = String(v);
  if (s.includes('@')) return `${s[0]}•••@${s.split('@')[1]}`;
  return `${s.slice(0, 3)}${s.length > 6 ? ' ' + s.slice(3, 5) : ''}•••••${s.slice(-3)}`;
};

/**
 * Every variable in the editor, filled from what we know. Dates/amounts that do not apply show "—" so
 * one missing value never blocks a message; event-specific ones (reason, utr, ...) stay unset and block.
 */
export function buildVars({ member, subscription, payment, invoice, company = {}, siteUrl = '', extra = {} }) {
  const plan = subscription?.plan;
  const price = subscription?.price;
  const interval = price ? cap(price.interval) : '';
  const cur = payment?.currency ?? price?.currency ?? 'INR';
  const v = {
    member_name: member?.full_name,
    member_email: member?.email,
    member_phone: member?.mobile ?? '—',
    membership_name: plan?.name ?? '—',
    membership_plan: plan ? `${plan.name}${interval ? ' · ' + interval : ''}` : '—',
    membership_id: member?.member_no ?? '—',
    membership_status: subscription ? cap(subscription.status) : '—',
    start_date: fmtDate(subscription?.starts_at),
    expiry_date: subscription?.ends_at ? fmtDate(subscription.ends_at) : subscription ? 'Lifetime' : '—',
    renewal_date: subscription?.ends_at ? fmtDate(subscription.ends_at) : '—',
    amount: fmtMoney(payment?.amount ?? 0, cur),
    currency: cur,
    transaction_id: payment?.gateway_payment_id ?? payment?.reference ?? '—',
    payment_status: payment ? cap(payment.status) : '—',
    payment_date: fmtDate(payment?.paid_at ?? payment?.created_at),
    invoice_url: invoice ? `${siteUrl}/membership/account/invoices/${invoice.id}` : `${siteUrl}/membership/account/invoices`,
    invoice_number: invoice?.number ?? '—',
    cancellation_date: fmtDate(subscription?.cancelled_at ?? subscription?.ends_at),
    support_email: company.support_email,
    company_name: company.name,
    company_logo: company.logo_url || `${siteUrl}/logo.png`,
    website_url: `${siteUrl}/membership/account`,
    refund_amount: fmtMoney(payment?.refunded_amount ?? 0, cur),
    utr: payment?.utr,
    reason: subscription?.rejected_reason ?? subscription?.suspended_reason ?? subscription?.cancel_reason ?? payment?.failure_reason,
    login_time: fmtDateTime(new Date()),
    changed_fields: 'profile details',
  };
  return { ...v, ...Object.fromEntries(Object.entries(extra).filter(([, x]) => x !== undefined && x !== null && x !== '')) };
}
