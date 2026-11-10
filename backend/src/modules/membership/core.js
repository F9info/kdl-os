// Subscription lifecycle shared by public signup, the member area, admin actions and webhooks.
import { prisma } from '../../config/database.js';
import { hashPassword } from '../auth/service.js';
import {
  periodEnd, assertTransition, statusAfterPayment, financialYear, invoiceNumber, memberNumber, paymentReference,
  pickCurrentSubscription, calcPrice, validateFieldValues, toValueColumns, fromValueColumns, sweepDecisions,
} from './domain.js';
import { nextSeq } from './sequences.js';
import { getSettings } from './settings.js';
import { httpError, notFound, recordEvent } from './util.js';

export const LIVE = ['ACTIVE', 'PAST_DUE', 'TRIALING'];
const subInclude = { plan: true, price: true };

export const withBreakdown = (price) => (price ? { ...price, breakdown: calcPrice(price) } : price);

export async function getPlanBySlug(slug, db = prisma) {
  const plan = await db.membershipPlan.findUnique({ where: { slug }, include: { prices: { where: { is_active: true } }, benefits: { orderBy: { sort: 'asc' } } } });
  if (!plan || plan.visibility === 'ARCHIVED') throw notFound('Plan');
  return plan;
}

export function pickPrice(plan, interval) {
  if (plan.is_free) return null;
  const price = plan.prices.find((p) => p.interval === interval && p.is_active);
  if (!price) throw httpError(422, `Plan ${plan.name} has no ${interval} price`);
  return price;
}

export async function currentSubscription(memberId, db = prisma) {
  const subs = await db.membershipSubscription.findMany({ where: { member_id: memberId }, include: subInclude, orderBy: { created_at: 'desc' } });
  return pickCurrentSubscription(subs);
}

export const subscriptionFor = (id, db = prisma) =>
  db.membershipSubscription.findUnique({ where: { id }, include: { ...subInclude, member: true } });

export async function setStatus(tx, sub, to, data = {}, { actor = null, key, description } = {}) {
  assertTransition(sub.status, to);
  const updated = await tx.membershipSubscription.update({ where: { id: sub.id }, data: { status: to, ...data }, include: subInclude });
  await recordEvent(tx, {
    key: key ?? `subscription.${to.toLowerCase()}`,
    member_id: sub.member_id,
    actor,
    data: { subscription_id: sub.id, from: sub.status, to },
    description: description ?? `Subscription ${sub.status} -> ${to}`,
  });
  return updated;
}

/** First activation or rejoin: dates, member number, and retire any other running subscription. */
export async function activate(tx, subId, { actor = null, approvedBy = null, endsAt, startsAt } = {}) {
  const sub = await tx.membershipSubscription.findUnique({ where: { id: subId }, include: { ...subInclude, member: true } });
  if (!sub) throw notFound('Subscription');
  const now = startsAt ?? new Date();
  const ends = endsAt !== undefined ? endsAt : sub.price ? periodEnd(now, sub.price.interval) : null;
  const rejoin = !!sub.member.member_since;

  for (const other of await tx.membershipSubscription.findMany({ where: { member_id: sub.member_id, id: { not: sub.id }, status: { in: LIVE } } })) {
    await setStatus(tx, other, 'CANCELLED', { cancelled_at: now, ends_at: now, cancel_reason: 'plan_changed' }, { actor, key: 'subscription.replaced' });
  }

  const updated = await setStatus(
    tx, sub, 'ACTIVE',
    { starts_at: now, ends_at: ends, grace_ends_at: null, cancel_at_period_end: false, ...(approvedBy ? { approved_by: approvedBy, approved_at: now } : {}) },
    { actor, key: rejoin ? 'member.rejoined' : 'member.activated', description: rejoin ? 'Member rejoined' : 'Membership activated' }
  );

  const patch = {};
  if (!sub.member.member_since) patch.member_since = now;
  if (!sub.member.member_no) {
    const settings = await getSettings(tx);
    const year = now.getUTCFullYear();
    patch.member_no = memberNumber(year, await nextSeq(tx, `member:${year}`), settings.general.member_no_prefix);
  }
  if (Object.keys(patch).length) await tx.member.update({ where: { id: sub.member_id }, data: patch });
  return updated;
}

/** Paid again while running (or lapsed): extend from the old end, or from now if it already ended. */
async function renew(tx, sub, actor) {
  const now = new Date();
  const base = sub.status === 'ACTIVE' && sub.ends_at && sub.ends_at > now ? sub.ends_at : now;
  const ends = sub.price ? periodEnd(base, sub.price.interval) : null;
  const data = { ends_at: ends, grace_ends_at: null, cancel_at_period_end: false, ...(base === now ? { starts_at: now } : {}) };
  if (sub.status === 'ACTIVE') {
    const u = await tx.membershipSubscription.update({ where: { id: sub.id }, data, include: subInclude });
    await recordEvent(tx, { key: 'subscription.renewed', member_id: sub.member_id, actor, data: { subscription_id: sub.id, ends_at: ends } });
    return u;
  }
  return setStatus(tx, sub, 'ACTIVE', data, { actor, key: 'subscription.renewed' });
}

export async function issueInvoice(tx, { payment, member, subscription }) {
  const now = new Date();
  const fy = financialYear(now);
  const settings = await getSettings(tx);
  const seq = await nextSeq(tx, `invoice:${fy}`);
  const plan = subscription?.plan;
  const subtotal = payment.amount - payment.tax_amount;
  return tx.membershipInvoice.create({
    data: {
      number: invoiceNumber(fy, seq, false, settings.general.invoice_prefix),
      fy, seq,
      member_id: member.id,
      subscription_id: subscription?.id ?? null,
      payment_id: payment.id,
      bill_to_name: member.legal_name || member.full_name,
      bill_to_gstin: member.gstin,
      bill_to_address: [member.address, member.city, member.state, member.pincode].filter(Boolean).join(', ') || null,
      description: plan ? `${plan.name} membership${subscription.price ? ` (${subscription.price.interval.toLowerCase().replace('_', ' ')})` : ''}` : 'Membership payment',
      subtotal,
      gst_rate: subscription?.price?.gst_rate ?? settings.general.gst_rate_default,
      tax_amount: payment.tax_amount,
      total: payment.amount,
      currency: payment.currency,
      issued_at: now,
    },
  });
}

/** Mark a payment PAID (idempotent), invoice it, and move its subscription forward. One transaction. */
export async function markPaid(paymentId, { actor = null, gatewayPaymentId, verified = false } = {}) {
  return prisma.$transaction(
    async (tx) => {
      const pay = await tx.membershipPayment.findUnique({ where: { id: paymentId }, include: { member: true, subscription: { include: subInclude } } });
      if (!pay) throw notFound('Payment');
      if (pay.status === 'PAID') return pay;
      if (['REFUNDED', 'REJECTED'].includes(pay.status)) throw httpError(409, `Payment is ${pay.status}`);
      const now = new Date();
      const paid = await tx.membershipPayment.update({
        where: { id: pay.id },
        data: {
          status: 'PAID', paid_at: now, failure_reason: null,
          ...(gatewayPaymentId ? { gateway_payment_id: gatewayPaymentId } : {}),
          ...(verified ? { verified_by: actor, verified_at: now } : {}),
        },
      });
      await recordEvent(tx, { key: 'payment.paid', member_id: pay.member_id, actor, data: { payment_id: pay.id, amount: pay.amount }, description: `Payment ${pay.reference} paid` });
      if (pay.amount > 0) await issueInvoice(tx, { payment: paid, member: pay.member, subscription: pay.subscription });
      const sub = pay.subscription;
      if (sub?.status === 'PENDING_PAYMENT') {
        if (statusAfterPayment(sub.plan) === 'ACTIVE') await activate(tx, sub.id, { actor });
        else await setStatus(tx, sub, 'PENDING_APPROVAL', {}, { actor, key: 'subscription.pending_approval' });
      } else if (sub && ['ACTIVE', 'PAST_DUE', 'EXPIRED', 'TRIALING'].includes(sub.status)) {
        await renew(tx, sub, actor);
      }
      return paid;
    },
    { timeout: 30_000 }
  );
}

export async function createPayment(tx, { member, subscription, provider, provider_option, amount, tax_amount, currency = 'INR', status = 'PENDING' }) {
  return tx.membershipPayment.create({
    data: {
      reference: paymentReference(await nextSeq(tx, 'payment')),
      member_id: member.id,
      subscription_id: subscription?.id ?? null,
      provider_id: provider?.id ?? null,
      provider_option: provider_option ?? null,
      status, amount, tax_amount, currency,
    },
  });
}

/** Credit note for an invoice. The invoice stays; it is marked void. */
export async function voidInvoice(tx, invoiceId, reason, actor) {
  const inv = await tx.membershipInvoice.findUnique({ where: { id: invoiceId } });
  if (!inv) throw notFound('Invoice');
  if (inv.is_credit_note) throw httpError(409, 'A credit note cannot be voided');
  if (inv.voided_at) throw httpError(409, 'Invoice is already void');
  const now = new Date();
  const fy = financialYear(now);
  const settings = await getSettings(tx);
  const seq = await nextSeq(tx, `creditnote:${fy}`);
  await tx.membershipInvoice.update({ where: { id: inv.id }, data: { voided_at: now, void_reason: reason } });
  const note = await tx.membershipInvoice.create({
    data: {
      number: invoiceNumber(fy, seq, true, settings.general.invoice_prefix),
      fy, seq, is_credit_note: true, credit_for_id: inv.id,
      member_id: inv.member_id, subscription_id: inv.subscription_id, payment_id: inv.payment_id,
      bill_to_name: inv.bill_to_name, bill_to_gstin: inv.bill_to_gstin, bill_to_address: inv.bill_to_address,
      description: `Credit note for ${inv.number}`,
      subtotal: inv.subtotal, gst_rate: inv.gst_rate, tax_amount: inv.tax_amount, total: inv.total, currency: inv.currency,
      issued_at: now,
    },
  });
  await recordEvent(tx, { key: 'invoice.voided', member_id: inv.member_id, actor, data: { invoice: inv.number, credit_note: note.number, reason } });
  return note;
}

// ---------- accounts ----------

async function memberRole(tx) {
  return tx.rbacRole.upsert({
    where: { slug: 'member' },
    update: {},
    create: { name: 'Member', slug: 'member', description: 'Website member: self-service area only, no admin access', is_system: true },
  });
}

/** User (role `member`, zero permissions) + Member row. */
export async function createAccount(tx, { password, ...core }) {
  const email = core.email.toLowerCase();
  if (await tx.user.findUnique({ where: { email }, select: { id: true } })) throw httpError(409, 'Email already in use');
  const role = await memberRole(tx);
  const user = await tx.user.create({
    data: { name: core.full_name, email, phone: core.mobile ?? null, password_hash: await hashPassword(password) },
    select: { id: true, name: true, email: true, is_active: true, created_at: true },
  });
  await tx.userRole.create({ data: { user_id: user.id, role_id: role.id } });
  const { fields: _f, contacts: _c, plan_id: _p, plan_slug: _s, interval: _i, complimentary: _x, starts_at: _t, ...memberData } = core;
  const member = await tx.member.create({ data: { ...memberData, email, user_id: user.id } });
  return { user: { ...user, roles: ['member'] }, member };
}

export async function createSubscription(tx, { member, plan, price, status }) {
  return tx.membershipSubscription.create({
    data: { member_id: member.id, plan_id: plan.id, price_id: price?.id ?? null, status, auto_renew: true },
    include: subInclude,
  });
}

// ---------- profile fields ----------

/** Fields a plan asks of a member type (active, applicable groups only). */
export async function fieldsForPlan(planId, memberType, db = prisma) {
  const links = await db.membershipPlanFieldGroup.findMany({
    where: { plan_id: planId, member_type: memberType, group: { is_active: true } },
    include: { group: { include: { fields: { orderBy: { sort: 'asc' } } } } },
  });
  return links
    .filter((l) => ['BOTH', memberType].includes(l.group.applies_to))
    .flatMap((l) => l.group.fields.map((f) => ({ ...f, required: f.required && l.required })));
}

export async function saveFieldValues(tx, memberId, values, fields) {
  const errors = validateFieldValues(fields, values);
  if (Object.keys(errors).length) throw Object.assign(httpError(422, 'Validation failed'), { errors });
  const byKey = new Map();
  for (const f of fields) byKey.set(f.key, [...(byKey.get(f.key) ?? []), f]);
  for (const [key, v] of Object.entries(values)) {
    const matches = byKey.get(key);
    if (!matches) throw httpError(422, `Unknown field "${key}"`);
    for (const f of matches) {
      const cols = toValueColumns(f.type, v);
      if (f.is_unique && cols.value_text) {
        const dup = await tx.membershipFieldValue.findFirst({ where: { field_id: f.id, value_text: cols.value_text, member_id: { not: memberId } } });
        if (dup) throw httpError(409, `${f.label} is already registered`);
      }
      await tx.membershipFieldValue.upsert({
        where: { member_id_field_id: { member_id: memberId, field_id: f.id } },
        create: { member_id: memberId, field_id: f.id, ...cols },
        update: cols,
      });
    }
  }
}

export async function fieldValuesOf(memberId, db = prisma) {
  const rows = await db.membershipFieldValue.findMany({ where: { member_id: memberId }, include: { field: { select: { key: true } } } });
  return Object.fromEntries(rows.map((r) => [r.field.key, fromValueColumns(r)]));
}

// ---------- daily sweep ----------

/** ACTIVE past end -> PAST_DUE (grace); PAST_DUE past grace -> EXPIRED. Safe to run any number of times. */
export async function runExpirySweep({ now = new Date(), db = prisma } = {}) {
  const { general } = await getSettings(db);
  const candidates = await db.membershipSubscription.findMany({
    where: { OR: [{ status: 'ACTIVE', ends_at: { lte: now } }, { status: 'PAST_DUE', grace_ends_at: { lte: now } }] },
  });
  const decisions = sweepDecisions(candidates, now, general.grace_days);
  for (const d of decisions) {
    await db.membershipSubscription.update({ where: { id: d.id }, data: { status: d.to, ...d.data } });
    const sub = candidates.find((c) => c.id === d.id);
    await recordEvent(db, { key: `subscription.${d.to.toLowerCase()}`, member_id: sub.member_id, data: { subscription_id: d.id, from: d.from, to: d.to, sweep: true } });
  }
  return { changed: decisions.length, past_due: decisions.filter((d) => d.to === 'PAST_DUE').length, expired: decisions.filter((d) => d.to === 'EXPIRED').length, cancelled: decisions.filter((d) => d.to === 'CANCELLED').length };
}
