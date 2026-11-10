import { prisma } from '../../config/database.js';
import { withBreakdown } from './core.js';
import { httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

const full = { prices: { orderBy: { amount: 'asc' } }, benefits: { orderBy: { sort: 'asc' } }, field_groups: { include: { group: { select: { id: true, key: true, name: true } } } }, access_rules: true, _count: { select: { subscriptions: true } } };
const shape = (p) => (p ? { ...p, prices: p.prices?.map(withBreakdown) } : p);

const conflict = (e, msg) => {
  if (e.code === 'P2002') throw httpError(409, msg);
  throw e;
};

async function must(id, db = prisma) {
  const p = await db.membershipPlan.findUnique({ where: { id }, include: full });
  if (!p) throw notFound('Plan');
  return p;
}

export async function listPlans(q) {
  const where = {
    ...(q.visibility ? { visibility: q.visibility } : {}),
    ...(q.q ? { OR: [{ name: { contains: q.q, mode: 'insensitive' } }, { slug: { contains: q.q, mode: 'insensitive' } }] } : {}),
  };
  const r = await listResult(q, (p) => prisma.membershipPlan.findMany({ where, include: full, orderBy: orderBy(q.sort, ['sort', 'tier', 'name', 'created_at'], { sort: 'asc' }), ...p }), () => prisma.membershipPlan.count({ where }));
  return { ...r, items: r.items.map(shape) };
}

export const getPlan = async (id) => shape(await must(id));

export async function createPlan({ prices = [], benefits = [], ...body }, actor) {
  try {
    const p = await prisma.membershipPlan.create({
      data: {
        ...body,
        member_types: body.member_types ?? ['INDIVIDUAL', 'ORGANISATION'],
        is_free: body.is_free ?? prices.length === 0,
        prices: { create: prices },
        benefits: { create: benefits.map((b, sort) => ({ ...b, sort })) },
      },
    });
    await recordEvent(prisma, { key: 'plan.created', actor, data: { plan_id: p.id, slug: p.slug }, description: `Plan ${p.name} created` });
    return getPlan(p.id);
  } catch (e) {
    return conflict(e, 'A plan with this slug (or interval) already exists');
  }
}

export async function updatePlan(id, body, actor) {
  await must(id);
  try {
    await prisma.membershipPlan.update({ where: { id }, data: body });
  } catch (e) {
    conflict(e, 'A plan with this slug already exists');
  }
  await recordEvent(prisma, { key: 'plan.updated', actor, data: { plan_id: id, fields: Object.keys(body) }, description: 'Plan updated' });
  return getPlan(id);
}

export async function archivePlan(id, actor) {
  const p = await must(id);
  await prisma.membershipPlan.update({ where: { id }, data: { visibility: 'ARCHIVED' } });
  await recordEvent(prisma, { key: 'plan.archived', actor, data: { plan_id: id }, description: `Plan ${p.name} archived` });
  return getPlan(id);
}

export async function deletePlan(id, actor) {
  const p = await must(id);
  if (p._count.subscriptions > 0) return { deleted: false, archived: true, plan: await archivePlan(id, actor) };
  await prisma.membershipPlan.delete({ where: { id } });
  await recordEvent(prisma, { key: 'plan.deleted', actor, data: { plan_id: id, slug: p.slug }, description: `Plan ${p.name} deleted` });
  return { deleted: true, archived: false };
}

export async function addPrice(planId, body, actor) {
  await must(planId);
  try {
    const price = await prisma.membershipPlanPrice.create({ data: { ...body, plan_id: planId } });
    await recordEvent(prisma, { key: 'plan.price_added', actor, data: { plan_id: planId, price_id: price.id }, description: 'Plan price added' });
    return withBreakdown(price);
  } catch (e) {
    return conflict(e, 'This plan already has a price for that interval and currency');
  }
}

export async function updatePrice(id, body, actor) {
  try {
    const price = await prisma.membershipPlanPrice.update({ where: { id }, data: body });
    await recordEvent(prisma, { key: 'plan.price_updated', actor, data: { price_id: id }, description: 'Plan price updated' });
    return withBreakdown(price);
  } catch (e) {
    if (e.code === 'P2025') throw notFound('Price');
    return conflict(e, 'This plan already has a price for that interval and currency');
  }
}

export async function removePrice(id, actor) {
  const price = await prisma.membershipPlanPrice.findUnique({ where: { id }, include: { _count: { select: { subscriptions: true } } } });
  if (!price) throw notFound('Price');
  if (price._count.subscriptions > 0) {
    await prisma.membershipPlanPrice.update({ where: { id }, data: { is_active: false } });
    return { deleted: false, deactivated: true };
  }
  await prisma.membershipPlanPrice.delete({ where: { id } });
  await recordEvent(prisma, { key: 'plan.price_removed', actor, data: { price_id: id }, description: 'Plan price removed' });
  return { deleted: true, deactivated: false };
}

const replace = (model, planId, rows, actor, what) =>
  prisma
    .$transaction(async (tx) => {
      await tx[model].deleteMany({ where: { plan_id: planId } });
      if (rows.length) await tx[model].createMany({ data: rows.map((r) => ({ ...r, plan_id: planId })) });
    })
    .then(() => recordEvent(prisma, { key: `plan.${what}_set`, actor, data: { plan_id: planId, count: rows.length }, description: `Plan ${what.replace('_', ' ')} updated` }));

export async function setBenefits(id, list, actor) {
  await must(id);
  await replace('membershipBenefit', id, list.map((b, sort) => ({ ...b, sort })), actor, 'benefits');
  return getPlan(id);
}

export async function setFieldGroups(id, list, actor) {
  await must(id);
  const groups = await prisma.membershipFieldGroup.count({ where: { id: { in: list.map((l) => l.group_id) } } });
  if (groups !== new Set(list.map((l) => l.group_id)).size) throw httpError(422, 'Unknown field group');
  await replace('membershipPlanFieldGroup', id, list, actor, 'field_groups');
  return getPlan(id);
}

export async function setAccessRules(id, list, actor) {
  await must(id);
  await replace('membershipAccessRule', id, list, actor, 'access_rules');
  return getPlan(id);
}
