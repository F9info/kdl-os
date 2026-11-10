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
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    and.push({ OR: [{ reference: c }, { utr: c }, { gateway_payment_id: c }, { member: { full_name: c } }, { member: { email: c } }] });
  }
  const where = and.length ? { AND: and } : {};
  return listResult(q, (p) => prisma.membershipPayment.findMany({ where, include: payInclude, orderBy: orderBy(q.sort, ['created_at', 'amount', 'status', 'paid_at']), ...p }), () => prisma.membershipPayment.count({ where }));
}

export async function getPayment(id) {
  const p = await prisma.membershipPayment.findUnique({ where: { id }, include: { ...payInclude, invoices: true } });
  if (!p) throw notFound('Payment');
  return p;
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
  await recordEvent(prisma, { key: 'payment.rejected', member_id: p.member_id, actor, data: { payment_id: id, reason }, description: `Payment ${p.reference} rejected` });
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
  await recordEvent(prisma, { key: 'payment.refunded', member_id: p.member_id, actor, data: { payment_id: id, amount: refund }, description: `Payment ${p.reference} refunded` });
  return getPayment(id);
}

// ---------- approvals ----------

const apprInclude = { member: true, plan: true, price: true, payments: { orderBy: { created_at: 'desc' }, include: { provider: { select: { label: true, provider: true } } } } };

export async function listApprovals(q) {
  const where = { status: 'PENDING_APPROVAL', ...(q.q ? { member: { OR: [{ full_name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }] } } : {}) };
  return listResult(q, (p) => prisma.membershipSubscription.findMany({ where, include: apprInclude, orderBy: { created_at: 'asc' }, ...p }), () => prisma.membershipSubscription.count({ where }));
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
  await prisma.$transaction((tx) => activate(tx, s.id, { actor, approvedBy: actor }));
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
  const where = and.length ? { AND: and } : {};
  return listResult(q, (p) => prisma.membershipInvoice.findMany({ where, include: { member: memberBrief }, orderBy: orderBy(q.sort, ['issued_at', 'total', 'number'], { issued_at: 'desc' }), ...p }), () => prisma.membershipInvoice.count({ where }));
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

export async function overview() {
  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 86_400_000);
  const in30 = new Date(now.getTime() + 30 * 86_400_000);
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

  const [active, newMembers, revenue, pendingApprovals, expiring, growthRows, mix, recent, activeSubs] = await Promise.all([
    prisma.membershipSubscription.groupBy({ by: ['member_id'], where: { status: 'ACTIVE' } }).then((r) => r.length),
    prisma.member.count({ where: { created_at: { gte: d30 } } }),
    prisma.membershipPayment.aggregate({ _sum: { amount: true, refunded_amount: true }, where: { status: { in: ['PAID', 'REFUNDED'] }, paid_at: { gte: d30 } } }),
    prisma.membershipSubscription.count({ where: { status: 'PENDING_APPROVAL' } }),
    prisma.membershipSubscription.count({ where: { status: 'ACTIVE', ends_at: { gte: now, lte: in30 } } }),
    prisma.$queryRaw`SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count FROM members WHERE created_at >= ${since} GROUP BY 1 ORDER BY 1`,
    prisma.membershipSubscription.groupBy({ by: ['plan_id'], where: { status: 'ACTIVE' }, _count: { _all: true } }),
    prisma.member.findMany({ orderBy: { created_at: 'desc' }, take: 6, include: { subscriptions: { include: { plan: true }, orderBy: { created_at: 'desc' }, take: 1 } } }),
    prisma.membershipSubscription.findMany({ where: { status: 'ACTIVE', price_id: { not: null } }, select: { price: true } }),
  ]);

  // MRR: every running paid subscription, normalised to a month (lifetime counts as nothing recurring)
  const mrr = activeSubs.reduce((sum, s) => (s.price && INTERVAL_MONTHS[s.price.interval] ? sum + Math.round(calcPrice(s.price).total / INTERVAL_MONTHS[s.price.interval]) : sum), 0);
  const plans = await prisma.membershipPlan.findMany({ where: { id: { in: mix.map((m) => m.plan_id) } }, select: { id: true, name: true, slug: true, color: true } });
  const months = Array.from({ length: 12 }, (_, i) => new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth() + i, 1)).toISOString().slice(0, 7));
  const byMonth = Object.fromEntries(growthRows.map((r) => [r.month, r.count]));

  return {
    kpis: {
      active_members: active,
      new_members_30d: newMembers,
      revenue_30d: (revenue._sum.amount ?? 0) - (revenue._sum.refunded_amount ?? 0),
      mrr,
      pending_approvals: pendingApprovals,
      expiring_30d: expiring,
    },
    growth: months.map((month) => ({ month, count: byMonth[month] ?? 0 })),
    plan_mix: mix.map((m) => ({ plan: plans.find((p) => p.id === m.plan_id) ?? { id: m.plan_id }, count: m._count._all })),
    recent_members: recent.map(({ subscriptions, ...m }) => ({ ...m, plan: subscriptions[0]?.plan ?? null, status: subscriptions[0]?.status ?? null })),
  };
}
