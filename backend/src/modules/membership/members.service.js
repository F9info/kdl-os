import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { allowsMemberType, calcPrice, pickCurrentSubscription, proRataCredit, taxPortionOfTotal } from './domain.js';
import { LIVE, activate, createAccount, createPayment, createSubscription, currentSubscription, fieldValuesOf, getPlanBySlug, markPaid, pickPrice, saveFieldValues, setStatus } from './core.js';
import { cancel as cancelOwn } from './checkout.service.js';
import { addContact, listContacts, removeContact, updateContact } from './member.service.js';
import { importRowSchema } from './schema.js';
import { csvCell, httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

const randomPassword = () => crypto.randomBytes(18).toString('base64url');

// ---------- list / get ----------

function buildWhere(q) {
  const and = [];
  if (q.ids) and.push({ id: { in: String(q.ids).split(',').filter(Boolean) } });
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    and.push({ OR: [{ full_name: c }, { email: c }, { mobile: c }, { member_no: c }, { legal_name: c }] });
  }
  if (q.member_type) and.push({ member_type: q.member_type });
  if (q.tag) and.push({ tags: { has: q.tag } });
  if (q.city) and.push({ city: { contains: q.city, mode: 'insensitive' } });
  for (const [key, val] of Object.entries(q.fields ?? {})) and.push({ field_values: { some: { field: { key }, value_text: { equals: val, mode: 'insensitive' } } } });
  if (q.member_since_from || q.member_since_to) and.push({ member_since: { ...(q.member_since_from && { gte: q.member_since_from }), ...(q.member_since_to && { lte: q.member_since_to }) } });
  const sub = {};
  if (q.status) sub.status = q.status;
  if (q.plan_id) sub.plan_id = q.plan_id;
  if (q.valid_till_from || q.valid_till_to) sub.ends_at = { ...(q.valid_till_from && { gte: q.valid_till_from }), ...(q.valid_till_to && { lte: q.valid_till_to }) };
  if (Object.keys(sub).length) and.push({ subscriptions: { some: sub } });
  return and.length ? { AND: and } : {};
}

const listInclude = { subscriptions: { include: { plan: true, price: true }, orderBy: { created_at: 'desc' }, take: 6 } };
const withCurrent = ({ subscriptions, ...m }) => {
  const subscription = pickCurrentSubscription(subscriptions ?? []);
  return { ...m, subscription, plan: subscription?.plan ?? null, status: subscription?.status ?? null, valid_till: subscription?.ends_at ?? null };
};

export async function listMembers(q) {
  const where = buildWhere(q);
  const r = await listResult(q, (p) => prisma.member.findMany({ where, include: listInclude, orderBy: orderBy(q.sort, ['created_at', 'full_name', 'member_since', 'member_no', 'email']), ...p }), () => prisma.member.count({ where }));
  const ids = r.items.map((m) => m.id);
  const [paid, counts, contacts] = await Promise.all([
    prisma.membershipPayment.groupBy({ by: ['member_id'], where: { member_id: { in: ids }, status: { in: ['PAID', 'REFUNDED'] } }, _sum: { amount: true, refunded_amount: true } }),
    listSummary(),
    prisma.membershipContact.groupBy({ by: ['member_id'], where: { member_id: { in: ids } }, _count: { _all: true } }),
  ]);
  return {
    ...r,
    items: r.items.map(withCurrent).map((m) => {
      const t = paid.find((x) => x.member_id === m.id);
      return { ...m, lifetime_paid: (t?._sum.amount ?? 0) - (t?._sum.refunded_amount ?? 0), contacts_count: contacts.find((c) => c.member_id === m.id)?._count._all ?? 0 };
    }),
    summary: counts,
  };
}

/** Header line of the members screen: "1,249 active · 10 pending · 64 past due". */
async function listSummary() {
  const g = await prisma.membershipSubscription.groupBy({ by: ['status'], _count: { _all: true } });
  const n = (...s) => g.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count._all, 0);
  return { active: n('ACTIVE', 'TRIALING'), pending: n('PENDING_APPROVAL', 'PENDING_PAYMENT'), past_due: n('PAST_DUE'), total: await prisma.member.count() };
}

async function must(id, db = prisma) {
  const m = await db.member.findUnique({ where: { id } });
  if (!m) throw notFound('Member');
  return m;
}

export async function getMember(id) {
  const m = await prisma.member.findUnique({
    where: { id },
    include: {
      subscriptions: { include: { plan: true, price: true }, orderBy: { created_at: 'desc' } },
      contacts: { orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }] },
      payments: { orderBy: { created_at: 'desc' }, take: 20, include: { provider: { select: { label: true, provider: true } } } },
      invoices: { orderBy: { issued_at: 'desc' }, take: 20 },
    },
  });
  if (!m) throw notFound('Member');
  const { subscriptions, ...rest } = m;
  const subscription = pickCurrentSubscription(subscriptions);
  const fields = await fieldValuesOf(id);
  return { ...rest, subscription, plan: subscription?.plan ?? null, status: subscription?.status ?? null, subscriptions, fields, ...(await memberExtras(m, subscription, fields)) };
}

const GST_STATES = { '01': 'Jammu & Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', 10: 'Bihar', 11: 'Sikkim', 12: 'Arunachal Pradesh', 13: 'Nagaland', 14: 'Manipur', 15: 'Mizoram', 16: 'Tripura', 17: 'Meghalaya', 18: 'Assam', 19: 'West Bengal', 20: 'Jharkhand', 21: 'Odisha', 22: 'Chhattisgarh', 23: 'Madhya Pradesh', 24: 'Gujarat', 27: 'Maharashtra', 29: 'Karnataka', 30: 'Goa', 32: 'Kerala', 33: 'Tamil Nadu', 34: 'Puducherry', 36: 'Telangana', 37: 'Andhra Pradesh' };

/** GSTIN format check + state from its first two digits. No live GST-portal lookup is wired: legal_name stays empty. */
export function lookupGstin(gstin) {
  const g = String(gstin ?? '').trim().toUpperCase();
  const ok = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g);
  return { gstin: g, valid_format: ok, status: ok ? 'UNVERIFIED' : 'INVALID', state: ok ? GST_STATES[g.slice(0, 2)] ?? null : null, legal_name: null, pan: ok ? g.slice(2, 12) : null };
}

/** Detail-screen extras: how they joined, account, pack answers, notes log, what is still missing. */
async function memberExtras(m, subscription, fields) {
  const [user, identities, links, noteEvents] = await Promise.all([
    prisma.user.findUnique({ where: { id: m.user_id }, select: { email: true, last_login_at: true, roles: { select: { role: { select: { slug: true, name: true } } } } } }),
    prisma.membershipUserIdentity.findMany({ where: { user_id: m.user_id }, select: { id: true, provider: true, email: true } }),
    subscription ? prisma.membershipPlanFieldGroup.findMany({ where: { plan_id: subscription.plan_id, member_type: m.member_type }, include: { group: { include: { fields: { orderBy: { sort: 'asc' } } } } } }) : [],
    prisma.membershipEvent.findMany({ where: { member_id: m.id, key: 'member.note_saved' }, orderBy: { created_at: 'desc' }, take: 20 }),
  ]);
  const authors = await prisma.user.findMany({ where: { id: { in: [...new Set(noteEvents.map((e) => e.actor_id).filter(Boolean))] } }, select: { id: true, name: true } });
  const groups = links.map((l) => l.group);
  const missing = links.flatMap((l) => l.group.fields.filter((f) => f.required && l.required && (fields[f.key] == null || fields[f.key] === '')).map((f) => f.key));
  return {
    source: m.source ?? (identities[0]?.provider ?? 'website'),
    account: { email_verified: null, signup_method: identities[0]?.provider ?? 'password_or_otp', identities, last_login_at: user?.last_login_at ?? null, site_role: user?.roles.map((r) => r.role.name) ?? [] },
    packs: groups.map((g) => g.key),
    field_groups: groups.map((g) => ({ key: g.key, name: g.name, source: 'member', fields: g.fields.map((f) => ({ key: f.key, label: f.label, value: fields[f.key] ?? null, locked: f.visibility === 'VIEW' })) })),
    documents: [], // no document store yet: the Documents pack uses FILE fields (see field_groups)
    verification: [{ label: 'Email', value: m.email }, { label: 'Mobile', value: m.mobile ?? '—' }, { label: 'GSTIN', value: m.gstin ?? '—' }, { label: 'PAN', value: m.pan ?? '—' }],
    notes_log: noteEvents.filter((e) => e.data?.body).map((e) => ({ id: e.id, author: authors.find((a) => a.id === e.actor_id)?.name ?? 'Admin', body: e.data.body, created_at: e.created_at })),
    missing_required: missing,
  };
}

// ---------- segments (saved filters) ----------

const asQuery = (f = {}) => ({ ...f, ...Object.fromEntries(['member_since_from', 'member_since_to', 'valid_till_from', 'valid_till_to'].filter((k) => f[k]).map((k) => [k, new Date(f[k])])) });

export async function listSegments() {
  const rows = await prisma.membershipSegment.findMany({ orderBy: { created_at: 'desc' } });
  const items = await Promise.all(rows.map(async (s) => ({ ...s, count: await prisma.member.count({ where: buildWhere(asQuery(s.filters)) }) })));
  return { items };
}

export async function createSegment({ name, filters }, actor) {
  const s = await prisma.membershipSegment.create({ data: { name, filters, created_by: actor } });
  await recordEvent(prisma, { key: 'segment.created', actor, data: { name }, description: `Segment "${name}" saved` });
  return { ...s, count: await prisma.member.count({ where: buildWhere(asQuery(filters)) }) };
}

export async function deleteSegment(id, actor) {
  const s = await prisma.membershipSegment.findUnique({ where: { id } });
  if (!s) throw notFound('Segment');
  await prisma.membershipSegment.delete({ where: { id } });
  await recordEvent(prisma, { key: 'segment.deleted', actor, data: { name: s.name }, description: `Segment "${s.name}" deleted` });
  return { deleted: true };
}

// ---------- extra admin actions ----------

export async function changePlanQuote(id, { plan_id, interval }) {
  const m = await must(id);
  const plan = await resolvePlan({ plan_id });
  const price = pickPrice(plan, interval);
  if (!price) return { kind: 'change', credit: 0, price: 0, tax: 0, total: 0, free: true };
  const { quote } = await import('./checkout.service.js');
  const q = await quote(m, plan, price);
  return { kind: q.kind, credit: q.credit, price: q.subtotal, tax: q.tax, total: q.total, list_total: q.list_total, currency: q.currency };
}

export async function sendPasswordReset(id, actor) {
  const m = await must(id);
  const { createPasswordResetToken } = await import('../auth/service.js');
  await createPasswordResetToken(m.email);
  await recordEvent(prisma, { key: 'member.password_reset_sent', member_id: id, actor, data: {}, description: 'Password reset link sent by an admin' });
  return { sent: true };
}

export async function resendWelcome(id, actor) {
  const m = await must(id);
  if (process.env.NODE_ENV !== 'test') {
    const { emitMembershipEvent } = await import('./comm/dispatch.js');
    await emitMembershipEvent('account.created', m.id, {});
  }
  await recordEvent(prisma, { key: 'member.welcome_resent', member_id: id, actor, data: { welcome: false }, description: 'Welcome message sent again' });
  return { sent: true };
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Bulk e-mail from the members list. One message per member through the Integrations e-mail provider. */
export async function bulkEmail(ids, { subject, message }, actor) {
  if (!subject || !message) throw httpError(422, 'subject and message are required');
  const { dispatchMessage } = await import('../integrations/service.js');
  const members = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, full_name: true } });
  let sent = 0;
  const failed = [];
  for (const m of members) {
    try {
      await dispatchMessage({ channel: 'EMAIL', to: m.email, subject, body: `<p>Hi ${esc(m.full_name)},</p>${message.split(/\n{2,}/).map((p) => `<p>${esc(p)}</p>`).join('')}`, source: 'membership.bulk', meta: { member_id: m.id } });
      sent += 1;
    } catch (e) {
      failed.push({ id: m.id, reason: e.message });
    }
  }
  await recordEvent(prisma, { key: 'member.bulk_email', actor, data: { count: sent, subject }, description: `Bulk e-mail "${subject}" to ${sent} members` });
  return { count: sent, failed };
}

const anyFields = (keys, memberType) =>
  prisma.membershipField.findMany({ where: { key: { in: keys }, group: { is_active: true, applies_to: { in: ['BOTH', memberType] } } } });

// ---------- create / update ----------

async function resolvePlan({ plan_id, plan_slug }) {
  if (plan_slug) return getPlanBySlug(plan_slug);
  const p = await prisma.membershipPlan.findUnique({ where: { id: plan_id }, include: { prices: { where: { is_active: true } }, benefits: true } });
  if (!p || p.visibility === 'ARCHIVED') throw notFound('Plan');
  return p;
}

export async function createMember(body, actor) {
  const { plan_id, plan_slug, interval, complimentary: comp, starts_at, fields: values = {}, contacts = [], payment, send_welcome, issue_invoice: _inv, ...core } = body;
  const complimentary = comp || payment?.mode === 'COMPLIMENTARY';
  if (!core.email) {
    if (!core.mobile) throw httpError(422, 'An email or a mobile number is required');
    core.email = `${String(core.mobile).replace(/\D/g, '')}@noemail.invalid`; // account email is required; this one never receives mail
  }
  core.source ??= 'admin';
  const plan = plan_id || plan_slug ? await resolvePlan({ plan_id, plan_slug }) : null;
  const price = plan ? pickPrice(plan, interval ?? [...plan.prices].sort((a, b) => a.amount - b.amount)[0]?.interval) : null;
  if (plan && !allowsMemberType(plan, core.member_type)) throw httpError(422, `Plan ${plan.name} is not open to ${core.member_type.toLowerCase()} members`);
  const fieldDefs = await anyFields(Object.keys(values), core.member_type);

  const id = await prisma.$transaction(
    async (tx) => {
      const { member } = await createAccount(tx, { ...core, password: randomPassword() });
      await saveFieldValues(tx, member.id, values, fieldDefs);
      for (const [i, c] of contacts.entries()) await tx.membershipContact.create({ data: { ...c, member_id: member.id, is_primary: i === 0 } });
      await recordEvent(tx, { key: 'member.added', member_id: member.id, actor, data: { offline: true, plan: plan?.slug ?? null, complimentary: !!complimentary, welcome: send_welcome !== false && !core.email.endsWith('@noemail.invalid') }, description: `${member.full_name} added by an admin` });
      if (plan) {
        const sub = await createSubscription(tx, { member, plan, price, status: 'PENDING_PAYMENT' });
        if (complimentary || plan.is_free) await activate(tx, sub.id, { actor, approvedBy: actor, startsAt: starts_at });
      }
      return member.id;
    },
    { timeout: 30_000 }
  );
  if (payment?.mode === 'OFFLINE' && plan && !plan.is_free) await recordPayment(id, { amount: payment.amount, method: payment.method ?? 'OTHER', utr: payment.reference }, actor);
  return getMember(id);
}

export async function updateMember(id, { fields: values, ...body }, actor) {
  const m = await must(id);
  await prisma.$transaction(async (tx) => {
    if (body.email && body.email !== m.email) {
      if (await tx.user.findFirst({ where: { email: body.email, id: { not: m.user_id } } })) throw httpError(409, 'Email already in use');
      await tx.user.update({ where: { id: m.user_id }, data: { email: body.email } });
    }
    if (Object.keys(body).length) await tx.member.update({ where: { id }, data: body });
    if (values) await saveFieldValues(tx, id, values, await anyFields(Object.keys(values), body.member_type ?? m.member_type));
    if (body.mobile && body.mobile !== m.mobile) await recordEvent(tx, { key: 'member.mobile_changed', member_id: id, actor, data: {}, description: 'Mobile number changed by an admin' });
    if (body.email && body.email !== m.email) await recordEvent(tx, { key: 'member.email_changed', member_id: id, actor, data: {}, description: 'Email changed by an admin' });
    await recordEvent(tx, { key: 'member.updated', member_id: id, actor, data: { fields: [...Object.keys(body), ...(values ? ['fields'] : [])] }, description: 'Member updated by an admin' });
  });
  return getMember(id);
}

// ---------- actions ----------

const needCurrent = async (member) => {
  const sub = await currentSubscription(member.id);
  if (!sub) throw httpError(409, 'Member has no subscription');
  return sub;
};

export async function extend(id, { days, until }, actor) {
  const m = await must(id);
  const sub = await needCurrent(m);
  if (!['ACTIVE', 'PAST_DUE', 'EXPIRED', 'TRIALING'].includes(sub.status)) throw httpError(409, `Cannot extend a ${sub.status} subscription`);
  if (!sub.ends_at && sub.status === 'ACTIVE') throw httpError(409, 'Lifetime memberships do not expire');
  const now = new Date();
  const base = sub.ends_at && sub.ends_at > now ? sub.ends_at : now;
  const ends = until ?? new Date(base.getTime() + days * 86_400_000);
  await prisma.$transaction(async (tx) => {
    if (sub.status === 'ACTIVE') {
      await tx.membershipSubscription.update({ where: { id: sub.id }, data: { ends_at: ends, grace_ends_at: null } });
      await recordEvent(tx, { key: 'subscription.extended', member_id: id, actor, data: { subscription_id: sub.id, ends_at: ends }, description: 'Membership extended' });
    } else await setStatus(tx, sub, 'ACTIVE', { ends_at: ends, grace_ends_at: null }, { actor, key: 'subscription.extended' });
  });
  return getMember(id);
}

/** Admin switch: immediate, no payment, no pro-rata. Use record-payment to take money. */
export async function changePlan(id, { plan_id, plan_slug, interval, apply }, actor) {
  const m = await must(id);
  const plan = await resolvePlan({ plan_id, plan_slug });
  const price = pickPrice(plan, interval);
  const cur = await currentSubscription(id);
  if (apply === 'renewal' && cur && LIVE.includes(cur.status)) {
    await prisma.membershipSubscription.update({ where: { id: cur.id }, data: { pending_plan_id: plan.id } });
    await recordEvent(prisma, { key: 'subscription.downgrade_scheduled', member_id: id, actor, data: { subscription_id: cur.id, to_plan: plan.slug }, description: `Plan change to ${plan.name} scheduled for renewal` });
    return getMember(id);
  }
  await prisma.$transaction(async (tx) => {
    if (cur && LIVE.includes(cur.status)) {
      await tx.membershipSubscription.update({ where: { id: cur.id }, data: { plan_id: plan.id, price_id: price?.id ?? null, pending_plan_id: null } });
      await recordEvent(tx, { key: 'subscription.plan_changed', member_id: id, actor, data: { subscription_id: cur.id, from: cur.plan.slug, to: plan.slug, plan_change: true }, description: `Plan changed to ${plan.name}` });
    } else {
      const sub = await createSubscription(tx, { member: m, plan, price, status: 'PENDING_PAYMENT' });
      await activate(tx, sub.id, { actor, approvedBy: actor });
    }
  });
  return getMember(id);
}

export async function suspend(id, reason, actor) {
  const sub = await needCurrent(await must(id));
  await prisma.$transaction((tx) => setStatus(tx, sub, 'SUSPENDED', { suspended_reason: reason ?? null }, { actor, key: 'subscription.suspended' }));
  return getMember(id);
}

export async function reactivate(id, actor) {
  const sub = await needCurrent(await must(id));
  await prisma.$transaction((tx) => setStatus(tx, sub, 'ACTIVE', { suspended_reason: null }, { actor, key: 'subscription.reactivated' }));
  return getMember(id);
}

export async function cancelMember(id, { refund, notify: _n, ...body }, actor) {
  const sub = await currentSubscription(id);
  await cancelOwn(await must(id), body, actor);
  if (refund && refund !== 'none' && sub) {
    const { refundPayment } = await import('./billing.service.js');
    const last = await prisma.membershipPayment.findFirst({ where: { subscription_id: sub.id, status: 'PAID' }, orderBy: { paid_at: 'desc' } });
    if (last) {
      const left = last.amount - last.refunded_amount;
      const amt = refund === 'full' ? left : Math.min(left, proRataCredit({ paid_total: last.amount, starts_at: sub.starts_at, ends_at: sub.ends_at }));
      if (amt > 0) await refundPayment(last.id, amt, actor);
    }
  }
  return getMember(id);
}

/** An offline payment (cash, cheque, transfer) taken by an admin: PAID at once, invoiced, activates. */
export async function recordPayment(id, { amount, method, utr, note, plan_id, interval }, actor) {
  const m = await must(id);
  let sub = await currentSubscription(id);
  if (plan_id) {
    const plan = await resolvePlan({ plan_id });
    const price = pickPrice(plan, interval);
    if (!sub || sub.plan_id !== plan.id || !['PENDING_PAYMENT', ...LIVE, 'EXPIRED'].includes(sub.status))
      sub = await prisma.$transaction((tx) => createSubscription(tx, { member: m, plan, price, status: 'PENDING_PAYMENT' }));
  }
  if (!sub) throw httpError(422, 'Give plan_id and interval: this member has no subscription yet');
  if (!sub.price) throw httpError(422, 'This plan is free: nothing to pay');
  const q = calcPrice(sub.price);
  const total = amount ?? q.total;
  const payment = await prisma.$transaction((tx) =>
    createPayment(tx, { member: m, subscription: sub, amount: total, tax_amount: total === q.total ? q.tax : taxPortionOfTotal(total, sub.price.gst_rate), currency: sub.price.currency, status: 'UNDER_VERIFICATION' })
  );
  await prisma.membershipPayment.update({ where: { id: payment.id }, data: { utr: utr ?? null, note: [method, note].filter(Boolean).join(': ') || null } });
  await markPaid(payment.id, { actor, verified: true });
  return getMember(id);
}

export async function setNotes(id, notes, actor) {
  await must(id);
  await prisma.member.update({ where: { id }, data: { notes } });
  await recordEvent(prisma, { key: 'member.note_saved', member_id: id, actor, data: { body: String(notes).slice(0, 2000) }, description: 'Member notes saved' });
  return getMember(id);
}

// contacts: same rules as the member area, addressed by member id
export const adminContacts = async (id) => (await must(id), listContacts(id));
export const adminAddContact = async (id, body, actor) => addContact(await must(id), body, actor);
export const adminUpdateContact = async (id, cid, body, actor) => updateContact(await must(id), cid, body, actor);
export const adminRemoveContact = async (id, cid, actor) => removeContact(await must(id), cid, actor);

export async function activity(id, q) {
  await must(id);
  const r = await listResult(q, (p) => prisma.membershipEvent.findMany({ where: { member_id: id }, orderBy: { created_at: 'desc' }, ...p }), () => prisma.membershipEvent.count({ where: { member_id: id } }));
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(r.items.map((e) => e.actor_id).filter(Boolean))] } }, select: { id: true, name: true } });
  return { ...r, items: r.items.map((e) => ({ ...e, actor_name: users.find((u) => u.id === e.actor_id)?.name ?? (e.actor_id ? 'Member' : 'System'), ip: null })) };
}

// ---------- bulk / export ----------

const COLUMN_GROUPS = { name_email: ['full_name', 'email'], phone: ['mobile'], member_no: ['member_no'], plan_status: ['plan', 'status'], member_since: ['member_since'], valid_till: ['valid_till'], lifetime_paid: ['lifetime_paid'], address: ['address', 'city', 'state', 'pincode'], custom_fields: [] };
const CSV_COLS = ['member_no', 'full_name', 'email', 'mobile', 'member_type', 'legal_name', 'gstin', 'city', 'state', 'plan', 'status', 'member_since', 'valid_till', 'tags'];
function toCsv(rows, columns) {
  const cols = columns?.length ? columns.flatMap((c) => COLUMN_GROUPS[c] ?? []) : CSV_COLS;
  const lines = [cols.join(',')];
  const val = (r, c) => ({ plan: r.plan?.name, status: r.subscription?.status, valid_till: r.subscription?.ends_at, tags: r.tags.join(';'), lifetime_paid: r.lifetime_paid != null ? (r.lifetime_paid / 100).toFixed(2) : '' })[c] ?? r[c];
  for (const r of rows.map(withCurrent)) lines.push(cols.map((c) => csvCell(val(r, c))).join(','));
  return lines.join('\n') + '\n';
}

export async function exportMembers(q, actor = null) {
  const rows = await prisma.member.findMany({ where: buildWhere(q), include: listInclude, orderBy: { created_at: 'desc' }, take: 10_000 });
  const paid = await prisma.membershipPayment.groupBy({ by: ['member_id'], where: { member_id: { in: rows.map((r) => r.id) }, status: { in: ['PAID', 'REFUNDED'] } }, _sum: { amount: true, refunded_amount: true } });
  for (const r of rows) {
    const t = paid.find((x) => x.member_id === r.id);
    r.lifetime_paid = (t?._sum.amount ?? 0) - (t?._sum.refunded_amount ?? 0);
  }
  await recordEvent(prisma, { key: 'member.exported', actor, data: { count: rows.length, columns: q.columns ?? null }, description: `Exported ${rows.length} members` });
  // ponytail: xlsx is served as CSV (Excel opens it); add a real xlsx writer when a dependency is approved
  return toCsv(rows, q.columns ? String(q.columns).split(',') : null);
}

export async function bulk({ ids, action, tags = [], remove, plan_id, interval, subject, message, reason }, actor) {
  if (action === 'send-email') return bulkEmail(ids, { subject, message }, actor);
  if (action === 'send-renewal-link' || action === 'suspend') {
    const failed = [];
    let done = 0;
    for (const id of ids) {
      try {
        if (action === 'suspend') await suspend(id, reason, actor);
        else {
          const sub = await currentSubscription(id);
          if (!sub?.ends_at) throw httpError(409, 'No running membership to renew');
          const { emitMembershipEvent } = await import('./comm/dispatch.js');
          const { daysLeftText, istDayDiff } = await import('./comm/render.js');
          await emitMembershipEvent('renewal.reminder', id, { subscription_id: sub.id, vars: { days_left: daysLeftText(istDayDiff(sub.ends_at)) } });
        }
        done++;
      } catch (e) {
        failed.push({ id, error: e.message });
      }
    }
    return { count: done, failed };
  }
  if (action === 'export') {
    const rows = await prisma.member.findMany({ where: { id: { in: ids } }, include: listInclude });
    return { count: rows.length, csv: toCsv(rows) };
  }
  if (action === 'tag') {
    if (!tags.length) throw httpError(422, 'tags is required');
    const members = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } });
    await prisma.$transaction(
      members.map((m) => prisma.member.update({ where: { id: m.id }, data: { tags: remove ? m.tags.filter((t) => !tags.includes(t)) : [...new Set([...m.tags, ...tags])] } }))
    );
    await recordEvent(prisma, { key: 'member.bulk_tagged', actor, data: { count: members.length, tags, remove: !!remove }, description: `Bulk ${remove ? 'untag' : 'tag'} of ${members.length} members` });
    return { count: members.length };
  }
  if (!plan_id || !interval) throw httpError(422, 'plan_id and interval are required');
  const failed = [];
  let done = 0;
  for (const id of ids) {
    try {
      await changePlan(id, { plan_id, interval }, actor);
      done++;
    } catch (e) {
      failed.push({ id, error: e.message });
    }
  }
  return { count: done, failed };
}

// ---------- import ----------

/** Rows are the parsed CSV (header -> value); mapping says which column feeds which member field. */
function mapRows(rows, mapping) {
  const seen = new Set();
  return rows.map((raw, i) => {
    const mapped = {};
    for (const [col, field] of Object.entries(mapping)) if (field) mapped[field] = raw[col];
    const parsed = importRowSchema.safeParse(mapped);
    const errors = parsed.success ? [] : parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`);
    const email = parsed.success ? parsed.data.email : String(mapped.email ?? '').toLowerCase();
    if (email && seen.has(email)) errors.push('email: duplicate in this file');
    if (email) seen.add(email);
    return { row: i + 1, data: parsed.success ? parsed.data : mapped, errors };
  });
}

export async function importPreview({ rows, mapping }) {
  const mapped = mapRows(rows, mapping);
  const emails = mapped.filter((r) => !r.errors.length).map((r) => r.data.email);
  const existing = new Set((await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email));
  for (const r of mapped) if (!r.errors.length && existing.has(r.data.email)) r.errors.push('email: already registered');
  const valid = mapped.filter((r) => !r.errors.length).length;
  return { total: mapped.length, valid, invalid: mapped.length - valid, rows: mapped.slice(0, 500) };
}

export async function importCommit({ rows, mapping, plan_slug, member_type }, actor) {
  const plan = plan_slug ? await getPlanBySlug(plan_slug) : null;
  const price = plan?.is_free === false ? pickPrice(plan, 'YEARLY') : null;
  const out = { created: 0, skipped: 0, errors: [] };
  // ponytail: one transaction per row (bcrypt cost makes ~4 rows/s); move to a BullMQ job for big files
  for (const r of mapRows(rows, mapping)) {
    if (r.errors.length) {
      out.skipped++;
      out.errors.push({ row: r.row, errors: r.errors });
      continue;
    }
    try {
      await prisma.$transaction(
        async (tx) => {
          const data = { ...r.data, member_type: member_type ?? r.data.member_type };
          const { member } = await createAccount(tx, { ...data, password: randomPassword() });
          await recordEvent(tx, { key: 'member.imported', member_id: member.id, actor, data: { row: r.row }, description: `${member.full_name} imported` });
          if (plan) {
            const sub = await createSubscription(tx, { member, plan, price, status: 'PENDING_PAYMENT' });
            await activate(tx, sub.id, { actor, approvedBy: actor });
          }
        },
        { timeout: 30_000 }
      );
      out.created++;
    } catch (e) {
      out.skipped++;
      out.errors.push({ row: r.row, errors: [e.message] });
    }
  }
  return out;
}
