import { prisma } from '../../config/database.js';
import { couponProblem } from './domain.js';
import { httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

const norm = (code) => String(code).trim().toUpperCase();
// A payment that failed or was rejected frees the code again; open and paid ones hold it.
const HOLDING = ['PENDING', 'AWAITING_PROOF', 'UNDER_VERIFICATION', 'PAID', 'REFUNDED'];

const conflict = (e) => {
  if (e.code === 'P2002') throw httpError(409, 'A coupon with this code already exists');
  throw e;
};

/** The coupon for `code` if this member may use it on this plan now; otherwise a 422 saying why. */
export async function resolveCoupon(code, { member, plan }, db = prisma) {
  const coupon = await db.membershipCoupon.findUnique({ where: { code: norm(code) } });
  const [redeemed, redeemedByMember] = coupon
    ? await Promise.all([
        db.membershipPayment.count({ where: { coupon_id: coupon.id, status: { in: HOLDING } } }),
        db.membershipPayment.count({ where: { coupon_id: coupon.id, member_id: member.id, status: { in: HOLDING } } }),
      ])
    : [0, 0];
  const problem = couponProblem(coupon, { planSlug: plan.slug, redeemed, redeemedByMember });
  if (problem) throw httpError(422, problem);
  return coupon;
}

export async function listCoupons(q) {
  const where = {
    ...(q.active ? { is_active: q.active === 'true' } : {}),
    ...(q.q ? { OR: [{ code: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] } : {}),
  };
  const r = await listResult(
    q,
    (p) => prisma.membershipCoupon.findMany({ where, orderBy: orderBy(q.sort, ['code', 'created_at', 'valid_to'], { created_at: 'desc' }), ...p }),
    () => prisma.membershipCoupon.count({ where })
  );
  const used = await prisma.membershipPayment.groupBy({
    by: ['coupon_id'],
    where: { coupon_id: { in: r.items.map((c) => c.id) }, status: { in: HOLDING } },
    _count: { _all: true },
    _sum: { discount_amount: true },
  });
  return {
    ...r,
    items: r.items.map((c) => {
      const u = used.find((x) => x.coupon_id === c.id);
      return { ...c, redeemed: u?._count._all ?? 0, discount_given: u?._sum.discount_amount ?? 0 };
    }),
  };
}

export async function createCoupon(body, actor) {
  try {
    const c = await prisma.membershipCoupon.create({ data: { ...body, code: norm(body.code) } });
    await recordEvent(prisma, { key: 'coupon.created', actor, data: { coupon_id: c.id, code: c.code }, description: `Coupon ${c.code} created` });
    return c;
  } catch (e) {
    return conflict(e);
  }
}

export async function updateCoupon(id, body, actor) {
  const cur = await prisma.membershipCoupon.findUnique({ where: { id } });
  if (!cur) throw notFound('Coupon');
  const merged = { ...cur, ...body };
  if (merged.discount_type === 'PERCENT' && merged.value > 100) throw httpError(422, 'A percentage cannot be more than 100');
  const data = { ...body, ...(body.code ? { code: norm(body.code) } : {}) };
  try {
    const c = await prisma.membershipCoupon.update({ where: { id }, data });
    await recordEvent(prisma, { key: 'coupon.updated', actor, data: { coupon_id: id }, description: `Coupon ${c.code} updated` });
    return c;
  } catch (e) {
    return conflict(e);
  }
}

/** A coupon that was ever used is switched off instead of deleted, so payment history keeps its reference. */
export async function deleteCoupon(id, actor) {
  const c = await prisma.membershipCoupon.findUnique({ where: { id }, include: { _count: { select: { payments: true } } } });
  if (!c) throw notFound('Coupon');
  if (c._count.payments > 0) {
    await prisma.membershipCoupon.update({ where: { id }, data: { is_active: false } });
    return { id, deleted: false, deactivated: true };
  }
  await prisma.membershipCoupon.delete({ where: { id } });
  await recordEvent(prisma, { key: 'coupon.deleted', actor, data: { code: c.code }, description: `Coupon ${c.code} deleted` });
  return { id, deleted: true, deactivated: false };
}
