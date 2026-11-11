import { prisma } from '../../config/database.js';
import { checkAccess } from './domain.js';
import { LIVE, currentSubscription, fieldValuesOf, saveFieldValues } from './core.js';
import { httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

export async function memberForUser(userId) {
  const m = await prisma.member.findUnique({ where: { user_id: userId } });
  if (!m) throw httpError(403, 'No membership profile for this account');
  return m;
}

export async function getMe(member) {
  const [subscription, contacts, fields] = await Promise.all([
    currentSubscription(member.id),
    prisma.membershipContact.findMany({ where: { member_id: member.id }, orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }] }),
    fieldValuesOf(member.id),
  ]);
  const pending_plan = subscription?.pending_plan_id ? await prisma.membershipPlan.findUnique({ where: { id: subscription.pending_plan_id }, select: { id: true, slug: true, name: true } }) : null;
  const plan = subscription?.plan ? { ...subscription.plan, benefits: await prisma.membershipBenefit.findMany({ where: { plan_id: subscription.plan.id }, orderBy: { sort: 'asc' } }) } : null;
  return { member, subscription, plan, status: subscription?.status ?? null, pending_plan, contacts, fields };
}

export async function updateProfile(member, body, actor) {
  const updated = await prisma.member.update({
    where: { id: member.id },
    data: { ...body, ...(body.whatsapp_opt_in !== undefined ? { whatsapp_opt_in_at: body.whatsapp_opt_in ? new Date() : null, whatsapp_opt_in_source: body.whatsapp_opt_in ? 'profile' : null } : {}) },
  });
  if (body.mobile && body.mobile !== member.mobile) await recordEvent(prisma, { key: 'member.mobile_changed', member_id: member.id, actor, data: {}, description: 'Mobile number changed' });
  await recordEvent(prisma, { key: 'member.profile_updated', member_id: member.id, actor, data: { fields: Object.keys(body) }, description: 'Member updated their profile' });
  return updated;
}

export async function updateFields(member, values, actor) {
  const keys = Object.keys(values);
  const fields = await prisma.membershipField.findMany({
    where: { key: { in: keys }, visibility: 'EDIT', group: { is_active: true, member_editable: true, applies_to: { in: ['BOTH', member.member_type] } } },
  });
  await prisma.$transaction((tx) => saveFieldValues(tx, member.id, values, fields));
  await recordEvent(prisma, { key: 'member.fields_updated', member_id: member.id, actor, data: { fields: keys }, description: 'Member updated profile fields' });
  return fieldValuesOf(member.id);
}

// ---------- contacts (shared with admin) ----------

export const listContacts = (memberId) =>
  prisma.membershipContact.findMany({ where: { member_id: memberId }, orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }] });

export async function addContact(member, body, actor) {
  const sub = await currentSubscription(member.id);
  const max = sub?.plan.max_contacts ?? 5;
  return prisma.$transaction(async (tx) => {
    const count = await tx.membershipContact.count({ where: { member_id: member.id } });
    if (count >= max) throw httpError(422, `This plan allows up to ${max} contacts`);
    const primary = body.is_primary || count === 0;
    if (primary) await tx.membershipContact.updateMany({ where: { member_id: member.id }, data: { is_primary: false } });
    const c = await tx.membershipContact.create({ data: { ...body, is_primary: primary, member_id: member.id } });
    await recordEvent(tx, { key: 'contact.added', member_id: member.id, actor, data: { contact_id: c.id }, description: `Contact ${c.name} added` });
    return c;
  });
}

export async function updateContact(member, id, body, actor) {
  const c = await prisma.membershipContact.findFirst({ where: { id, member_id: member.id } });
  if (!c) throw notFound('Contact');
  return prisma.$transaction(async (tx) => {
    if (body.is_primary) await tx.membershipContact.updateMany({ where: { member_id: member.id, id: { not: id } }, data: { is_primary: false } });
    if (body.is_primary === false && c.is_primary) throw httpError(422, 'Make another contact primary instead');
    const u = await tx.membershipContact.update({ where: { id }, data: body });
    await recordEvent(tx, { key: 'contact.updated', member_id: member.id, actor, data: { contact_id: id }, description: `Contact ${u.name} updated` });
    return u;
  });
}

export async function removeContact(member, id, actor) {
  const c = await prisma.membershipContact.findFirst({ where: { id, member_id: member.id } });
  if (!c) throw notFound('Contact');
  if (c.is_primary && (await prisma.membershipContact.count({ where: { member_id: member.id } })) > 1) throw httpError(422, 'Make another contact primary before removing this one');
  await prisma.membershipContact.delete({ where: { id } });
  await recordEvent(prisma, { key: 'contact.removed', member_id: member.id, actor, data: { contact_id: id }, description: `Contact ${c.name} removed` });
  return { deleted: true };
}

// ---------- history ----------

export const myPayments = (member, q) => {
  const where = { member_id: member.id };
  return listResult(q, (p) => prisma.membershipPayment.findMany({ where, include: { provider: { select: { label: true, provider: true } } }, orderBy: orderBy(q.sort, ['created_at', 'amount']), ...p }), () => prisma.membershipPayment.count({ where }));
};

export const myInvoices = (member, q) => {
  const where = { member_id: member.id };
  return listResult(q, (p) => prisma.membershipInvoice.findMany({ where, orderBy: { issued_at: 'desc' }, ...p }), () => prisma.membershipInvoice.count({ where }));
};

export async function myInvoice(member, id) {
  const inv = await prisma.membershipInvoice.findFirst({ where: { id, member_id: member.id }, include: { payment: { select: { reference: true, gateway_payment_id: true, utr: true } } } });
  if (!inv) throw notFound('Invoice');
  // intra-state supply splits GST evenly into CGST + SGST (inter-state IGST needs the place of supply: not tracked yet)
  const half = Math.floor(inv.tax_amount / 2);
  return { ...inv, lines: [{ description: inv.description, sac: '999599', quantity: 1, amount: inv.subtotal }], cgst: half, sgst: inv.tax_amount - half, igst: 0, payment_ref: inv.payment?.gateway_payment_id ?? inv.payment?.utr ?? inv.payment?.reference ?? null };
}

// ---------- access ----------

const allRules = () => prisma.membershipAccessRule.findMany({ include: { plan: { select: { id: true, slug: true, name: true, tier: true } } } });

export async function accessFor(member, path) {
  const sub = await currentSubscription(member.id);
  const plan = sub && LIVE.includes(sub.status) ? sub.plan : null;
  return checkAccess(await allRules(), path, plan);
}

/** Everything the member's plan unlocks (plans at or below their tier). */
export async function library(member) {
  const sub = await currentSubscription(member.id);
  const plan = sub && LIVE.includes(sub.status) ? sub.plan : null;
  const out = { pages: [], sections: [], media: [], urls: [] };
  const key = { PAGE: 'pages', SECTION: 'sections', MEDIA: 'media', URL_PATTERN: 'urls' };
  for (const r of await allRules()) {
    const locked = !plan || r.plan.tier > plan.tier;
    out[key[r.target]].push({ id: r.id, value: r.value, label: r.label ?? r.value, plan: r.plan.name, locked, plan_required: locked ? { slug: r.plan.slug, name: r.plan.name, tier: r.plan.tier } : null });
  }
  return out;
}
