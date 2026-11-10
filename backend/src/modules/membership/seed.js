import { DEFAULT_SETTINGS } from './settings.js';

// Idempotent: safe to run on every install / re-install. Never overwrites what an admin changed.
// The seven sector field packs are not created here; they are offered by GET /admin/field-groups/presets
// and created with one click (POST /admin/field-groups/presets/apply).
const PLANS = [
  { slug: 'free', name: 'Free', tier: 1, is_free: true, description: 'Join the community at no cost.', sort: 1, prices: [], benefits: ['Member directory listing', 'Community newsletter'] },
  {
    slug: 'silver', name: 'Silver', tier: 2, description: 'Everything in Free, plus member-only content.', sort: 2,
    prices: [{ interval: 'MONTHLY', amount: 9900 }, { interval: 'YEARLY', amount: 99900 }],
    benefits: ['Everything in Free', 'Members-only articles', 'Event discounts'],
  },
  {
    slug: 'gold', name: 'Gold', tier: 3, description: 'Full access with priority support.', sort: 3, is_featured: true,
    prices: [{ interval: 'MONTHLY', amount: 24900 }, { interval: 'YEARLY', amount: 249900 }],
    benefits: ['Everything in Silver', 'Priority support', 'Free event tickets'],
  },
];

export default async function seed(tx) {
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS))
    await tx.membershipSetting.upsert({ where: { key }, create: { key, value }, update: {} });

  await tx.rbacRole.upsert({
    where: { slug: 'member' },
    create: { name: 'Member', slug: 'member', description: 'Website member: self-service area only, no admin access', is_system: true },
    update: {},
  });

  for (const { prices, benefits, ...plan } of PLANS) {
    const row = await tx.membershipPlan.upsert({ where: { slug: plan.slug }, create: { ...plan, member_types: ['INDIVIDUAL', 'ORGANISATION'] }, update: {} });
    for (const p of prices)
      await tx.membershipPlanPrice.upsert({
        where: { plan_id_interval_currency: { plan_id: row.id, interval: p.interval, currency: 'INR' } },
        create: { ...p, plan_id: row.id, gst_rate: 18, tax_mode: 'EXCLUSIVE' },
        update: {},
      });
    if ((await tx.membershipBenefit.count({ where: { plan_id: row.id } })) === 0)
      await tx.membershipBenefit.createMany({ data: benefits.map((text, sort) => ({ plan_id: row.id, text, sort, highlighted: sort === 0 && plan.slug === 'gold' })) });
  }

  const providers = [
    { provider: 'RAZORPAY', type: 'GATEWAY', label: 'Razorpay', description: 'UPI, cards, netbanking and wallets', status: 'DRAFT', mode: 'TEST', is_default: true, sort: 0 },
    {
      provider: 'BANK_TRANSFER', type: 'MANUAL', label: 'Bank transfer', description: 'Pay by NEFT/IMPS/UPI to our bank account and share the UTR', status: 'PUBLISHED', sort: 1,
      manual_config: { account_name: 'Your organisation', account_number: '0000000000', ifsc: 'XXXX0000000', bank: 'Your bank', proof_required: true, pay_within_days: 3 },
    },
  ];
  for (const p of providers)
    if ((await tx.membershipPaymentProvider.count({ where: { provider: p.provider } })) === 0) await tx.membershipPaymentProvider.create({ data: p });
}
