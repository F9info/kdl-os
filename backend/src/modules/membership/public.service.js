import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { signAccessToken, signRefreshToken, storeRefreshToken } from '../auth/service.js';
import { allowsMemberType, signupOutcome } from './domain.js';
import { getDriver } from './drivers/index.js';
import { webhookSecretOf } from './providers.service.js';
import { activate, assertSeat, createAccount, createSubscription, fieldsForPlan, getPlanBySlug, markPaid, saveFieldValues, withApprovalDefault, withBreakdown } from './core.js';
import { verifySignupToken } from './auth/otp.service.js';
import { getSettings } from './settings.js';
import { normalizeMobile } from './auth/otp.service.js';
import { httpError, recordEvent } from './util.js';
import { logger } from '../../shared/utils/logger.js';

export async function listPublicPlans() {
  const plans = await prisma.membershipPlan.findMany({
    where: { visibility: 'PUBLIC', status: 'ACTIVE' },
    include: { prices: { where: { is_active: true }, orderBy: { amount: 'asc' } }, benefits: { orderBy: { sort: 'asc' } } },
    orderBy: [{ sort: 'asc' }, { tier: 'asc' }],
  });
  return plans.map((p) => ({ ...p, prices: p.prices.map(withBreakdown) }));
}

export async function joinForm(planSlug, memberType) {
  const plan = await getPlanBySlug(planSlug);
  const types = memberType ? [memberType] : plan.member_types;
  const out = [];
  for (const mt of types) {
    const links = await prisma.membershipPlanFieldGroup.findMany({
      where: { plan_id: plan.id, member_type: mt, group: { is_active: true, ask_at_signup: true } },
      include: { group: { include: { fields: { where: { visibility: { not: 'HIDDEN' } }, orderBy: { sort: 'asc' } } } } },
      orderBy: { group: { sort: 'asc' } },
    });
    for (const l of links.filter((x) => ['BOTH', mt].includes(x.group.applies_to))) {
      const { fields, ...g } = l.group;
      out.push({ ...g, member_type: mt, required: l.required, fields });
    }
  }
  const { prices, benefits, ...planCore } = plan;
  return { plan: { ...planCore, prices: prices.map(withBreakdown), benefits }, member_type: memberType ?? null, groups: out };
}

export async function signup(body) {
  const settings = await getSettings();
  if (!settings.signup.member_types.includes(body.member_type)) throw httpError(422, 'This kind of membership is not open for sign-up');
  const plan = await getPlanBySlug(body.plan_slug);
  await assertSeat(plan);
  if (!allowsMemberType(plan, body.member_type)) throw httpError(422, `Plan ${plan.name} is not open to ${body.member_type.toLowerCase()} members`);
  let price = null;
  if (!plan.is_free) {
    price = body.interval ? plan.prices.find((p) => p.interval === body.interval) : [...plan.prices].sort((a, b) => a.amount - b.amount)[0];
    if (!price) throw httpError(422, 'Choose a billing interval this plan offers');
  }
  const fields = await fieldsForPlan(plan.id, body.member_type);
  const outcome = signupOutcome(await withApprovalDefault(plan));

  // OTP sign-up: the mobile was proven by a code, so there is no password (a random unusable one is stored)
  const { fields: values, plan_slug: _s, interval: _i, verification_token, ...core } = body;
  if (verification_token) {
    const proven = verifySignupToken(verification_token);
    if (!proven || proven !== normalizeMobile(core.mobile)) throw httpError(422, 'Mobile verification expired: verify your number again');
    core.password = crypto.randomBytes(24).toString('base64url');
  } else if (!core.password) throw httpError(422, 'Password is required');
  if (core.whatsapp_opt_in) Object.assign(core, { whatsapp_opt_in_at: new Date(), whatsapp_opt_in_source: 'signup' });
  const result = await prisma.$transaction(
    async (tx) => {
      const { user, member } = await createAccount(tx, core);
      await saveFieldValues(tx, member.id, values ?? {}, fields);
      let sub = await createSubscription(tx, { member, plan, price, status: outcome.status === 'PENDING_APPROVAL' ? 'PENDING_APPROVAL' : 'PENDING_PAYMENT' });
      await recordEvent(tx, { key: 'member.joined', member_id: member.id, actor: user.id, data: { plan: plan.slug, member_type: member.member_type, free: plan.is_free, subscription_id: sub.id }, description: `${member.full_name} joined (${plan.name})` });
      if (outcome.status === 'ACTIVE' || outcome.status === 'TRIALING') sub = await activate(tx, sub.id, { actor: user.id, trial: outcome.status === 'TRIALING' });
      return { user, member: await tx.member.findUnique({ where: { id: member.id } }), subscription: sub };
    },
    { timeout: 30_000 }
  );

  const accessToken = signAccessToken({ userId: result.user.id, email: result.user.email, roles: ['member'] });
  const refreshToken = signRefreshToken({ userId: result.user.id });
  await storeRefreshToken(result.user.id, refreshToken);
  return { member: result.member, subscription: result.subscription, next: outcome.next, user: result.user, accessToken, refreshToken };
}

// ---------- gateway webhooks ----------

export async function handleWebhook(providerKey, { rawBody, headers, body }) {
  const key = String(providerKey).toUpperCase();
  let driver;
  try {
    driver = getDriver(key);
  } catch {
    throw httpError(404, 'Unknown payment provider');
  }
  if (driver.type !== 'GATEWAY') throw httpError(404, 'Unknown payment provider');

  const signature = headers['x-razorpay-signature'] ?? headers['x-webhook-signature'];
  const candidates = await prisma.membershipPaymentProvider.findMany({ where: { provider: key, status: { not: 'ARCHIVED' }, webhook_secret_enc: { not: null } } });
  let provider = null;
  for (const c of candidates) {
    if (driver.verifyWebhook({ rawBody, signature }, await webhookSecretOf(c))) {
      provider = c;
      break;
    }
  }
  if (!provider) throw httpError(400, 'Invalid webhook signature');

  const externalId = String(headers['x-razorpay-event-id'] ?? crypto.createHash('sha256').update(rawBody).digest('hex'));
  let row = await prisma.membershipWebhookEvent.findUnique({ where: { provider_external_id: { provider: key, external_id: externalId } } });
  if (row?.processed) return { duplicate: true };
  row ??= await prisma.membershipWebhookEvent.create({ data: { provider: key, external_id: externalId, payload: body } }).catch((e) => {
    if (e.code === 'P2002') return null; // lost a race with a parallel delivery: that one processes it
    throw e;
  });
  if (!row) return { duplicate: true };

  const evt = driver.parseWebhook(body);
  if (evt?.order_id) {
    const payment = await prisma.membershipPayment.findFirst({ where: { gateway_order_id: evt.order_id } });
    if (payment && evt.type === 'payment.paid') {
      if (evt.amount != null && evt.amount !== payment.amount) logger.warn('membership webhook: amount mismatch, payment left unpaid', { payment: payment.reference, got: evt.amount, want: payment.amount });
      else await markPaid(payment.id, { gatewayPaymentId: evt.payment_id });
    } else if (payment && evt.type === 'payment.failed' && payment.status === 'PENDING') {
      await prisma.membershipPayment.update({ where: { id: payment.id }, data: { status: 'FAILED', failure_reason: evt.reason ?? 'Payment failed' } });
      await recordEvent(prisma, { key: 'payment.failed', member_id: payment.member_id, data: { payment_id: payment.id, subscription_id: payment.subscription_id }, description: `Payment ${payment.reference} failed` });
    }
  }
  await prisma.membershipWebhookEvent.update({ where: { id: row.id }, data: { processed: true } });
  return { received: true };
}

