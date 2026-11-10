import { prisma } from '../../config/database.js';
import { allowsMemberType, calcPrice, taxPortionOfTotal, proRataCredit, eligibleProviders } from './domain.js';
import { getDriver, isManualProvider } from './drivers/index.js';
import { credentialsOf } from './providers.service.js';
import { LIVE, createPayment, currentSubscription, createSubscription, getPlanBySlug, markPaid, pickPrice, setStatus } from './core.js';
import { httpError, notFound, recordEvent } from './util.js';

const REUSABLE = [...LIVE, 'EXPIRED', 'PENDING_PAYMENT'];

/**
 * What a checkout would charge. kind: new | renewal | upgrade | change.
 * An upgrade is credited for the unused days of the running subscription (pro-rata); a downgrade or
 * switch to a cheaper tier is charged in full and applies when paid (the old one is retired).
 */
export async function quote(member, plan, price, db = prisma) {
  const base = calcPrice(price);
  const cur = await currentSubscription(member.id, db);
  let kind = 'new';
  let credit = 0;
  if (cur && cur.plan_id === plan.id && REUSABLE.includes(cur.status)) kind = 'renewal';
  else if (cur && LIVE.includes(cur.status)) {
    kind = plan.tier > cur.plan.tier ? 'upgrade' : 'change';
    if (kind === 'upgrade') {
      const last = await db.membershipPayment.findFirst({ where: { subscription_id: cur.id, status: 'PAID' }, orderBy: { paid_at: 'desc' } });
      credit = proRataCredit({ paid_total: last?.amount ?? 0, starts_at: cur.starts_at, ends_at: cur.ends_at });
    }
  }
  credit = Math.min(credit, base.total);
  const total = base.total - credit;
  const tax = credit ? taxPortionOfTotal(total, price.gst_rate) : base.tax;
  return { kind, currency: price.currency, subtotal: total - tax, tax, total, credit, list_total: base.total, current_subscription_id: cur?.id ?? null };
}

async function loadPlanForMember(member, plan_slug, interval) {
  const plan = await getPlanBySlug(plan_slug);
  if (!allowsMemberType(plan, member.member_type)) throw httpError(422, `Plan ${plan.name} is not open to ${member.member_type.toLowerCase()} members`);
  return { plan, price: pickPrice(plan, interval) };
}

export async function checkoutProviders(member, { plan_slug, interval }) {
  const { plan, price } = await loadPlanForMember(member, plan_slug, interval);
  if (!price) return { quote: null, items: [] };
  const q = await quote(member, plan, price);
  const providers = await prisma.membershipPaymentProvider.findMany({ where: { status: 'PUBLISHED' }, include: { plans: true } });
  const items = eligibleProviders(providers, { planId: plan.id, memberType: member.member_type, region: price.currency === 'INR' ? 'INDIA' : 'OUTSIDE_INDIA', amount: q.total });
  return {
    quote: q,
    items: items.map((p) => ({ id: p.id, provider: p.provider, type: p.type, label: p.label, description: p.description, logo_url: p.logo_url, is_default: p.is_default, mode: p.mode, options: p.options, currency: p.currency })),
  };
}

export async function checkout(member, { plan_slug, interval, provider_id, provider_option }, actor) {
  const { plan, price } = await loadPlanForMember(member, plan_slug, interval);
  if (!price) throw httpError(422, 'Free plans need no payment');
  const q = await quote(member, plan, price);

  let provider = null;
  if (q.total > 0) {
    if (!provider_id) throw httpError(422, 'Choose a payment method');
    provider = await prisma.membershipPaymentProvider.findUnique({ where: { id: provider_id }, include: { plans: true } });
    const ok = provider && eligibleProviders([provider], { planId: plan.id, memberType: member.member_type, region: price.currency === 'INR' ? 'INDIA' : 'OUTSIDE_INDIA', amount: q.total }).length;
    if (!ok) throw httpError(422, 'This payment method is not available for this plan');
  }
  const manual = provider ? isManualProvider(provider.provider) : false;

  const { payment, sub } = await prisma.$transaction(async (tx) => {
    const cur = await currentSubscription(member.id, tx);
    // an abandoned checkout for another plan must not linger as a second pending subscription
    for (const s of await tx.membershipSubscription.findMany({ where: { member_id: member.id, status: 'PENDING_PAYMENT', plan_id: { not: plan.id } } }))
      await setStatus(tx, s, 'CANCELLED', { cancelled_at: new Date(), cancel_reason: 'checkout_abandoned' }, { actor });
    let sub;
    if (q.kind === 'renewal' && cur) {
      sub = await tx.membershipSubscription.update({ where: { id: cur.id }, data: { price_id: price.id }, include: { plan: true, price: true } });
    } else {
      sub = await createSubscription(tx, { member, plan, price, status: 'PENDING_PAYMENT' });
    }
    const payment = await createPayment(tx, { member, subscription: sub, provider, provider_option, amount: q.total, tax_amount: q.tax, currency: q.currency, status: manual ? 'AWAITING_PROOF' : 'PENDING' });
    await recordEvent(tx, { key: 'checkout.started', member_id: member.id, actor, data: { payment_id: payment.id, plan: plan.slug, kind: q.kind, amount: q.total }, description: `Checkout started for ${plan.name}` });
    return { payment, sub };
  });

  if (q.total === 0) return { payment: await markPaid(payment.id, { actor }), quote: q };
  if (manual) return { payment, instructions: provider.manual_config ?? {}, quote: q };

  try {
    const order = await getDriver(provider.provider).createOrder(
      { amount: q.total, currency: q.currency, receipt: payment.reference, notes: { payment_id: payment.id, member_id: member.id } },
      await credentialsOf(provider)
    );
    const updated = await prisma.membershipPayment.update({ where: { id: payment.id }, data: { gateway_order_id: order.order_id } });
    return { payment: updated, order, quote: q, subscription_id: sub.id };
  } catch (err) {
    await prisma.membershipPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failure_reason: String(err.message).slice(0, 300) } });
    throw err;
  }
}

async function ownPayment(member, id) {
  const p = await prisma.membershipPayment.findFirst({ where: { id, member_id: member.id }, include: { provider: true } });
  if (!p) throw notFound('Payment');
  return p;
}

export async function submitOfflineProof(member, id, { utr, proof_url, note }, actor) {
  const p = await ownPayment(member, id);
  if (!p.provider || !isManualProvider(p.provider.provider)) throw httpError(400, 'This payment is not an offline payment');
  if (!['AWAITING_PROOF', 'UNDER_VERIFICATION'].includes(p.status)) throw httpError(409, `Payment is ${p.status}`);
  const updated = await prisma.membershipPayment.update({ where: { id }, data: { utr, proof_url: proof_url ?? null, note: note ?? null, status: 'UNDER_VERIFICATION' } });
  await recordEvent(prisma, { key: 'payment.proof_submitted', member_id: member.id, actor, data: { payment_id: id, utr }, description: `Proof submitted for ${p.reference}` });
  return updated;
}

export async function confirmGatewayPayment(member, id, body, actor) {
  const p = await ownPayment(member, id);
  if (p.status === 'PAID') return p;
  if (!p.provider || isManualProvider(p.provider.provider)) throw httpError(400, 'This payment is not an online payment');
  if (!p.gateway_order_id || p.gateway_order_id !== body.razorpay_order_id) throw httpError(422, 'Order does not match this payment');
  const ok = getDriver(p.provider.provider).verifyCheckout(
    { order_id: body.razorpay_order_id, payment_id: body.razorpay_payment_id, signature: body.razorpay_signature },
    await credentialsOf(p.provider)
  );
  if (!ok) throw httpError(422, 'Payment signature could not be verified');
  return markPaid(id, { actor, gatewayPaymentId: body.razorpay_payment_id });
}

// ---------- renew / change plan / cancel ----------

export async function renew(member, actor) {
  const cur = await currentSubscription(member.id);
  if (!cur || !['ACTIVE', 'PAST_DUE', 'EXPIRED', 'TRIALING'].includes(cur.status)) throw httpError(409, 'There is no membership to renew');
  const plan = cur.pending_plan_id ? await prisma.membershipPlan.findUnique({ where: { id: cur.pending_plan_id }, include: { prices: { where: { is_active: true } } } }) : { ...cur.plan, prices: await prisma.membershipPlanPrice.findMany({ where: { plan_id: cur.plan_id, is_active: true } }) };
  if (plan.is_free || !cur.price) return { subscription: cur, next: 'none', message: 'This plan does not expire' };
  const price = plan.prices.find((p) => p.interval === cur.price.interval) ?? plan.prices[0];
  if (!price) throw httpError(422, 'The plan has no active price');
  return { type: 'renewal', plan_slug: plan.slug, interval: price.interval, quote: await quote(member, plan, price), next: 'checkout' };
}

export async function changePlan(member, { plan_slug, interval }, actor) {
  const cur = await currentSubscription(member.id);
  if (!cur || !LIVE.includes(cur.status)) throw httpError(409, 'You need a running membership to change plans');
  const { plan, price } = await loadPlanForMember(member, plan_slug, interval);
  if (plan.id === cur.plan_id) throw httpError(422, 'You are already on this plan');
  if (plan.tier > cur.plan.tier) {
    if (!price) throw httpError(422, 'Upgrade target has no price');
    return { type: 'upgrade', plan_slug, interval, quote: await quote(member, plan, price), next: 'checkout' };
  }
  const updated = await prisma.membershipSubscription.update({ where: { id: cur.id }, data: { pending_plan_id: plan.id }, include: { plan: true, price: true } });
  await recordEvent(prisma, { key: 'subscription.downgrade_scheduled', member_id: member.id, actor, data: { subscription_id: cur.id, to_plan: plan.slug }, description: `Downgrade to ${plan.name} scheduled for renewal` });
  return { type: 'downgrade', effective_at: cur.ends_at, subscription: updated, next: 'none' };
}

export async function cancel(member, { reason, immediately }, actor) {
  const cur = await currentSubscription(member.id);
  if (!cur || !['ACTIVE', 'PAST_DUE', 'TRIALING', 'PENDING_PAYMENT', 'PENDING_APPROVAL'].includes(cur.status)) throw httpError(409, 'There is nothing to cancel');
  if (immediately || ['PENDING_PAYMENT', 'PENDING_APPROVAL'].includes(cur.status) || !cur.ends_at) {
    const now = new Date();
    return prisma.$transaction((tx) => setStatus(tx, cur, 'CANCELLED', { cancelled_at: now, cancel_reason: reason ?? null, ends_at: now }, { actor, key: 'subscription.cancelled' }));
  }
  const updated = await prisma.membershipSubscription.update({ where: { id: cur.id }, data: { cancel_at_period_end: true, auto_renew: false, cancel_reason: reason ?? null }, include: { plan: true, price: true } });
  await recordEvent(prisma, { key: 'subscription.cancel_scheduled', member_id: member.id, actor, data: { subscription_id: cur.id, reason }, description: 'Cancellation scheduled at period end' });
  return updated;
}

