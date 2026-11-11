import { prisma } from '../../config/database.js';
import { INTERVAL_MONTHS, calcPrice } from './domain.js';
import { getDriver } from './drivers/index.js';
import { credentialsOf } from './providers.service.js';
import { activate, fieldValuesOf, markPaid, setStatus, voidInvoice } from './core.js';
import { httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

const memberBrief = { select: { id: true, full_name: true, email: true, mobile: true, member_no: true, member_type: true, legal_name: true } };

// ---------- payments ----------

const payInclude = { member: memberBrief, provider: { select: { id: true, label: true, provider: true, type: true } }, subscription: { include: { plan: { select: { id: true, slug: true, name: true } } } } };

export async function listPayments(q) {
  const and = [];
  if (q.status) and.push({ status: q.status });
  if (q.provider_id) and.push({ provider_id: q.provider_id });
  if (q.member_id) and.push({ member_id: q.member_id });
  if (q.from || q.to) and.push({ created_at: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } });
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    and.push({ OR: [{ reference: c }, { utr: c }, { gateway_payment_id: c }, { member: { full_name: c } }, { member: { email: c } }] });
  }
  const where = and.length ? { AND: and } : {};
  const r = await listResult(q, (p) => prisma.membershipPayment.findMany({ where, include: { ...payInclude, invoices: { select: { id: true, number: true, is_credit_note: true } } }, orderBy: orderBy(q.sort, ['created_at', 'amount', 'status', 'paid_at']), ...p }), () => prisma.membershipPayment.count({ where }));
  return { ...r, items: r.items.map(withPurpose), summary: await paymentSummary(q) };
}

const METHOD = { RAZORPAY: 'Online', BANK_TRANSFER: 'Bank transfer', CHEQUE: 'Cheque', CASH: 'Cash', STRIPE: 'Card', PAYPAL: 'PayPal' };
function withPurpose(p) {
  const inv = p.invoices?.find((i) => !i.is_credit_note) ?? null;
  const plan = p.subscription?.plan?.name;
  return { ...p, method: p.provider?.label ?? (p.provider_option || (p.provider && METHOD[p.provider.provider]) || 'Manual'), purpose: `Membership${plan ? ' · ' + plan : ''}`, invoice: inv ? { id: inv.id, number: inv.number } : null };
}

/** Month cards of the payments screen; the window is ?from/?to, else the current month. */
async function paymentSummary(q) {
  const now = new Date();
  const from = q.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = q.to ?? now;
  const within = { created_at: { gte: from, lte: to } };
  const [paid, failed, refunded, recovered, waiting, gst] = await Promise.all([
    prisma.membershipPayment.aggregate({ _sum: { amount: true, refunded_amount: true }, where: { status: { in: ['PAID', 'REFUNDED'] }, paid_at: { gte: from, lte: to } } }),
    prisma.membershipPayment.count({ where: { status: 'FAILED', ...within } }),
    prisma.membershipPayment.aggregate({ _sum: { refunded_amount: true }, where: { refunded_at: { gte: from, lte: to } } }),
    prisma.membershipPayment.count({ where: { status: 'PAID', paid_at: { gte: from, lte: to }, member: { payments: { some: { status: 'FAILED', created_at: { gte: from, lte: to } } } } } }),
    prisma.membershipPayment.count({ where: { status: 'UNDER_VERIFICATION' } }),
    prisma.membershipPayment.aggregate({ _sum: { tax_amount: true }, where: { status: { in: ['PAID', 'REFUNDED'] }, paid_at: { gte: from, lte: to } } }),
  ]);
  return { collected: net(paid), gst_payable: gst._sum.tax_amount ?? 0, failed, recovered, refunded: refunded._sum.refunded_amount ?? 0, waiting_verification: waiting, from, to };
}

export async function getPayment(id) {
  const p = await prisma.membershipPayment.findUnique({ where: { id }, include: { ...payInclude, invoices: true } });
  if (!p) throw notFound('Payment');
  return withPurpose(p);
}

export async function verifyPayment(id, actor) {
  const p = await getPayment(id);
  if (!['UNDER_VERIFICATION', 'AWAITING_PROOF'].includes(p.status)) throw httpError(409, `Payment is ${p.status}, not waiting for verification`);
  await markPaid(id, { actor, verified: true });
  return getPayment(id);
}

export async function rejectPayment(id, reason, actor) {
  const p = await getPayment(id);
  if (!['UNDER_VERIFICATION', 'AWAITING_PROOF'].includes(p.status)) throw httpError(409, `Payment is ${p.status}, not waiting for verification`);
  await prisma.membershipPayment.update({ where: { id }, data: { status: 'REJECTED', failure_reason: reason, verified_by: actor, verified_at: new Date() } });
  await recordEvent(prisma, { key: 'payment.rejected', member_id: p.member_id, actor, data: { payment_id: id, subscription_id: p.subscription_id, reason }, description: `Payment ${p.reference} rejected` });
  return getPayment(id);
}

export async function refundPayment(id, amount, actor) {
  const p = await prisma.membershipPayment.findUnique({ where: { id }, include: { provider: true } });
  if (!p) throw notFound('Payment');
  if (p.status !== 'PAID') throw httpError(409, 'Only paid payments can be refunded');
  const left = p.amount - p.refunded_amount;
  const refund = amount ?? left;
  if (refund <= 0 || refund > left) throw httpError(422, `Refund must be between 1 and ${left} paise`);
  if (p.provider && p.gateway_payment_id) {
    await getDriver(p.provider.provider).refund({ payment_id: p.gateway_payment_id, amount: refund }, await credentialsOf(p.provider));
  }
  const total = p.refunded_amount + refund;
  await prisma.membershipPayment.update({ where: { id }, data: { refunded_amount: total, refunded_at: new Date(), ...(total >= p.amount ? { status: 'REFUNDED' } : {}) } });
  await recordEvent(prisma, { key: 'payment.refunded', member_id: p.member_id, actor, data: { payment_id: id, subscription_id: p.subscription_id, amount: refund, currency: p.currency, partial: total < p.amount }, description: `Payment ${p.reference} refunded` });
  return getPayment(id);
}

// ---------- approvals ----------

const apprInclude = { member: true, plan: true, price: true, payments: { orderBy: { created_at: 'desc' }, include: { provider: { select: { label: true, provider: true } } } } };

export async function listApprovals(q) {
  const where = { status: 'PENDING_APPROVAL', ...(q.q ? { member: { OR: [{ full_name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } } : {}) };
  const r = await listResult(q, (p) => prisma.membershipSubscription.findMany({ where, include: apprInclude, orderBy: { created_at: 'asc' }, ...p }), () => prisma.membershipSubscription.count({ where }));
  const now = Date.now();
  return { ...r, items: r.items.map((x) => ({ ...x, waiting_days: Math.floor((now - x.created_at.getTime()) / 86_400_000), paid_total: x.payments.filter((p) => p.status === 'PAID').reduce((a, p) => a + p.amount, 0) })) };
}

export async function getApproval(subscriptionId) {
  const s = await prisma.membershipSubscription.findUnique({ where: { id: subscriptionId }, include: apprInclude });
  if (!s) throw notFound('Approval');
  return { ...s, fields: await fieldValuesOf(s.member_id) };
}

async function pending(subscriptionId) {
  const s = await prisma.membershipSubscription.findUnique({ where: { id: subscriptionId } });
  if (!s) throw notFound('Approval');
  if (s.status !== 'PENDING_APPROVAL') throw httpError(409, `Subscription is ${s.status}, not waiting for approval`);
  return s;
}

export async function approve(subscriptionId, actor) {
  const s = await pending(subscriptionId);
  const paid = await prisma.membershipPayment.count({ where: { subscription_id: s.id, status: 'PAID' } });
  await prisma.$transaction((tx) => activate(tx, s.id, { actor, approvedBy: actor, approved: true, trial: paid === 0 }));
  return getApproval(subscriptionId);
}

export async function reject(subscriptionId, { reason, message, refund }, actor) {
  const s = await pending(subscriptionId);
  if (refund) {
    // refund first: if the gateway refuses, the member stays pending and the admin can retry
    for (const pay of await prisma.membershipPayment.findMany({ where: { subscription_id: s.id, status: 'PAID' }, include: { invoices: true } })) {
      await refundPayment(pay.id, undefined, actor);
      for (const inv of pay.invoices.filter((i) => !i.is_credit_note && !i.voided_at)) await prisma.$transaction((tx) => voidInvoice(tx, inv.id, `Rejected: ${reason}`, actor));
    }
  }
  await prisma.$transaction((tx) => setStatus(tx, s, 'REJECTED', { rejected_reason: reason }, { actor, key: 'subscription.rejected', description: `Membership rejected: ${reason}` }));
  if (message) await recordEvent(prisma, { key: 'member.rejection_message', member_id: s.member_id, actor, data: { message }, description: 'Message to the rejected applicant saved' });
  return getApproval(subscriptionId);
}

// ---------- invoices ----------

export async function listInvoices(q) {
  const and = [];
  if (q.member_id) and.push({ member_id: q.member_id });
  if (q.fy) and.push({ fy: q.fy });
  if (q.kind) and.push({ is_credit_note: q.kind === 'credit_note' });
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    and.push({ OR: [{ number: c }, { bill_to_name: c }, { bill_to_gstin: c }] });
  }
  if (q.from || q.to) and.push({ issued_at: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } });
  const where = and.length ? { AND: and } : {};
  const r = await listResult(q, (p) => prisma.membershipInvoice.findMany({ where, include: { member: memberBrief }, orderBy: orderBy(q.sort, ['issued_at', 'total', 'number'], { issued_at: 'desc' }), ...p }), () => prisma.membershipInvoice.count({ where }));
  const now = new Date();
  const from = q.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = q.to ?? now;
  const win = { issued_at: { gte: from, lte: to } };
  const [inv, cn] = await Promise.all([
    prisma.membershipInvoice.aggregate({ _count: { _all: true }, _sum: { subtotal: true, tax_amount: true }, where: { is_credit_note: false, voided_at: null, ...win } }),
    prisma.membershipInvoice.count({ where: { is_credit_note: true, ...win } }),
  ]);
  return { ...r, summary: { invoices: inv._count._all, taxable: inv._sum.subtotal ?? 0, gst_collected: inv._sum.tax_amount ?? 0, credit_notes: cn, from, to } };
}

export async function getInvoice(id) {
  const inv = await prisma.membershipInvoice.findUnique({ where: { id }, include: { member: memberBrief, payment: { select: { id: true, reference: true, status: true } } } });
  if (!inv) throw notFound('Invoice');
  return inv;
}

export async function voidOne(id, reason, actor) {
  const note = await prisma.$transaction((tx) => voidInvoice(tx, id, reason, actor));
  return { invoice: await getInvoice(id), credit_note: note };
}

// ---------- overview ----------

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
const pct = (cur, prev) => (prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : cur ? 100 : 0);
const net = (agg) => (agg._sum.amount ?? 0) - (agg._sum.refunded_amount ?? 0);

export async function overview(q = {}) {
  const now = new Date();
  const days = RANGE_DAYS[q.range] ?? 30;
  const start = new Date(now.getTime() - days * 86_400_000);
  const prevStart = new Date(start.getTime() - days * 86_400_000);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const d90 = new Date(now.getTime() - 90 * 86_400_000);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const paidIn = (gte, lt) => prisma.membershipPayment.aggregate({ _sum: { amount: true, refunded_amount: true }, where: { status: { in: ['PAID', 'REFUNDED'] }, paid_at: { gte, lt } } });
  const evCount = (key, extra = {}) => prisma.membershipEvent.count({ where: { key, created_at: { gte: d90 }, ...extra } });

  const [active, newMembers, newPrev, revenue, revenuePrev, pendingApprovals, oldest, expiringSubs, growthRows, churnRows, mix, recent, activeSubs, renewed, lapsed] = await Promise.all([
    prisma.membershipSubscription.groupBy({ by: ['member_id'], where: { status: 'ACTIVE' } }).then((r) => r.length),
    prisma.member.count({ where: { created_at: { gte: start } } }),
    prisma.member.count({ where: { created_at: { gte: prevStart, lt: start } } }),
    paidIn(start, new Date(now.getTime() + 1)),
    paidIn(prevStart, start),
    prisma.membershipSubscription.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.membershipSubscription.findFirst({ where: { status: 'PENDING_APPROVAL' }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.membershipSubscription.findMany({ where: { status: 'ACTIVE', ends_at: { gte: now, lte: in30 } }, include: { price: true } }),
    prisma.$queryRaw`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count FROM members WHERE created_at >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.$queryRaw`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count FROM membership_events WHERE created_at >= ${since} AND key IN ('subscription.expired', 'subscription.cancelled') GROUP BY 1 ORDER BY 1`,
    prisma.membershipSubscription.groupBy({ by: ['plan_id'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
    prisma.member.findMany({ orderBy: { created_at: 'desc' }, take: 6, include: { subscriptions: { include: { plan: true, price: true }, orderBy: { created_at: 'desc' }, take: 1 } } }),
    prisma.membershipSubscription.findMany({ where: { status: 'ACTIVE', price_id: { not: null } }, select: { price: true } }),
    evCount('payment.paid', { data: { path: ['renewal'], equals: true } }),
    prisma.membershipEvent.count({ where: { key: { in: ['subscription.expired', 'subscription.past_due'] }, created_at: { gte: d90 } } }),
  ]);

  // MRR: every running paid subscription, normalised to a month (lifetime counts as nothing recurring)
  const mrr = activeSubs.reduce((sum, s) => (s.price && INTERVAL_MONTHS[s.price.interval] ? sum + Math.round(calcPrice(s.price).total / INTERVAL_MONTHS[s.price.interval]) : sum), 0);
  const plans = await prisma.membershipPlan.findMany({ where: { id: { in: mix.map((m) => m.plan_id) } }, select: { id: true, name: true, slug: true, color: true } });
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const byMonth = Object.fromEntries(growthRows.map((r) => [r.month, r.count]));
  const churnBy = Object.fromEntries(churnRows.map((r) => [r.month, r.count]));
  const paidTotals = await prisma.membershipPayment.groupBy({ by: ['member_id'], where: { member_id: { in: recent.map((m) => m.id) }, status: { in: ['PAID', 'REFUNDED'] } }, _sum: { amount: true, refunded_amount: true } });
  const rev = net(revenue);

  return {
    range: q.range ?? '30d',
    kpis: {
      active_members: active,
      new_members_30d: newMembers,
      revenue_30d: rev,
      mrr,
      pending_approvals: pendingApprovals,
      expiring_30d: expiringSubs.length,
      // changes against the previous period of the same length
      active_members_delta_pct: pct(newMembers, newPrev),
      revenue_30d_delta_pct: pct(rev, net(revenuePrev)),
      expiring_value: expiringSubs.reduce((a, x) => a + (x.price ? calcPrice(x.price).total : 0), 0),
      oldest_pending_days: oldest ? Math.floor((now - oldest.created_at) / 86_400_000) : 0,
      renewal_rate_90d: renewed + lapsed ? Math.round((renewed / (renewed + lapsed)) * 1000) / 10 : null,
    },
    growth: months.map((month) => ({ month, count: byMonth[month] ?? 0, churned: churnBy[month] ?? 0 })),
    plan_mix: mix.map((m) => ({ plan: plans.find((p) => p.id === m.plan_id) ?? { id: m.plan_id }, count: m._count._all })),
    recent_members: recent.map(({ subscriptions, ...m }) => {
      const t = paidTotals.find((x) => x.member_id === m.id);
      return { ...m, plan: subscriptions[0]?.plan ?? null, status: subscriptions[0]?.status ?? null, interval: subscriptions[0]?.price?.interval ?? null, ends_at: subscriptions[0]?.ends_at ?? null, paid_total: (t?._sum.amount ?? 0) - (t?._sum.refunded_amount ?? 0) };
    }),
  };
}

export async function approvalsCount() {
  const [count, oldest] = await Promise.all([
    prisma.membershipSubscription.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.membershipSubscription.findFirst({ where: { status: 'PENDING_APPROVAL' }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
  ]);
  return { count, oldest_days: oldest ? Math.floor((Date.now() - oldest.created_at.getTime()) / 86_400_000) : 0 };
}
