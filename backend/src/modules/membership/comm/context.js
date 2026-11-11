import { prisma } from '../../../config/database.js';
import { pickCurrentSubscription } from '../domain.js';

/** The rows a template may talk about, found from the ids the emitting code put in `data`. */
export async function contextFor(member, data = {}) {
  const include = { plan: true, price: true };
  const subscription = data.subscription_id
    ? await prisma.membershipSubscription.findUnique({ where: { id: data.subscription_id }, include })
    : pickCurrentSubscription(await prisma.membershipSubscription.findMany({ where: { member_id: member.id }, include }));
  const payment = data.payment_id ? await prisma.membershipPayment.findUnique({ where: { id: data.payment_id } }) : null;
  const invoice = payment ? await prisma.membershipInvoice.findFirst({ where: { payment_id: payment.id, is_credit_note: false }, orderBy: { issued_at: 'desc' } }) : null;
  const extra = { ...(data.vars ?? {}) };
  if (data.contact_id) {
    const c = await prisma.membershipContact.findUnique({ where: { id: data.contact_id } });
    if (c) extra.contact_name = c.name;
  }
  for (const k of ['old_plan', 'new_plan']) {
    const slug = data[k === 'old_plan' ? 'from' : 'to'];
    if (slug && data.plan_change) {
      const p = await prisma.membershipPlan.findUnique({ where: { slug }, select: { name: true } });
      if (p) extra[k] = p.name;
    }
  }
  return { subscription, payment, invoice, extra };
}
