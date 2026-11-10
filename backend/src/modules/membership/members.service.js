import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import { allowsMemberType, calcPrice, pickCurrentSubscription, taxPortionOfTotal } from './domain.js';
import { LIVE, activate, createAccount, createPayment, createSubscription, currentSubscription, fieldValuesOf, getPlanBySlug, markPaid, pickPrice, saveFieldValues, setStatus } from './core.js';
import { cancel as cancelOwn } from './checkout.service.js';
import { addContact, listContacts, removeContact, updateContact } from './member.service.js';
import { importRowSchema } from './schema.js';
import { csvCell, httpError, listResult, notFound, orderBy, recordEvent } from './util.js';

const randomPassword = () => crypto.randomBytes(18).toString('base64url');

// ---------- list / get ----------

function buildWhere(q) {
  const and = [];
  if (q.ids) and.push({ id: { in: String(q.ids).split(',').filter(Boolean) } });
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    and.push({ OR: [{ full_name: c }, { email: c }, { mobile: c }, { member_no: c }, { legal_name: c }] });
  }
  if (q.member_type) and.push({ member_type: q.member_type });
  if (q.tag) and.push({ tags: { has: q.tag } });
  if (q.member_since_from || q.member_since_to) and.push({ member_since: { ...(q.member_since_from && { gte: q.member_since_from }), ...(q.member_since_to && { lte: q.member_since_to }) } });
  const sub = {};
  if (q.status) sub.status = q.status;
  if (q.plan_id) sub.plan_id = q.plan_id;
  if (q.valid_till_from || q.valid_till_to) sub.ends_at = { ...(q.valid_till_from && { gte: q.valid_till_from }), ...(q.valid_till_to && { lte: q.valid_till_to }) };
  if (Object.keys(sub).length) and.push({ subscriptions: { some: sub } });
  return and.length ? { AND: and } : {};
}

const listInclude = { subscriptions: { include: { plan: true, price: true }, orderBy: { created_at: 'desc' }, take: 6 } };
const withCurrent = ({ subscriptions, ...m }) => {
  const subscription = pickCurrentSubscription(subscriptions ?? []);
  return { ...m, subscription, plan: subscription?.plan ?? null };
};

export async function listMembers(q) {
  const where = buildWhere(q);
  const r = await listResult(q, (p) => prisma.member.findMany({ where, include: listInclude, orderBy: orderBy(q.sort, ['created_at', 'full_name', 'member_since', 'member_no', 'email']), ...p }), () => prisma.member.count({ where }));
  return { ...r, items: r.items.map(withCurrent) };
}

async function must(id, db = prisma) {
  const m = await db.member.findUnique({ where: { id } });
  if (!m) throw notFound('Member');
  return m;
}

export async function getMember(id) {
  const m = await prisma.member.findUnique({
    where: { id },
    include: {
      subscriptions: { include: { plan: true, price: true }, orderBy: { created_at: 'desc' } },
      contacts: { orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }] },
      payments: { orderBy: { created_at: 'desc' }, take: 20, include: { provider: { select: { label: true, provider: true } } } },
      invoices: { orderBy: { issued_at: 'desc' }, take: 20 },
    },
  });
  if (!m) throw notFound('Member');
  const { subscriptions, ...rest } = m;
  const subscription = pickCurrentSubscription(subscriptions);
  return { ...rest, subscription, plan: subscription?.plan ?? null, subscriptions, fields: await fieldValuesOf(id) };
}

const anyFields = (keys, memberType) =>
  prisma.membershipField.findMany({ where: { key: { in: keys }, group: { is_active: true, applies_to: { in: ['BOTH', memberType] } } } });

// ---------- create / update ----------

async function resolvePlan({ plan_id, plan_slug }) {
  if (plan_slug) return getPlanBySlug(plan_slug);
  const p = await prisma.membershipPlan.findUnique({ where: { id: plan_id }, include: { prices: { where: { is_active: true } }, benefits: true } });
  if (!p || p.visibility === 'ARCHIVED') throw notFound('Plan');
  return p;
}

export async function createMember(body, actor) {
  const { plan_id, plan_slug, interval, complimentary, starts_at, fields: values = {}, contacts = [], ...core } = body;
  const plan = plan_id || plan_slug ? await resolvePlan({ plan_id, plan_slug }) : null;
  const price = plan ? pickPrice(plan, interval ?? [...plan.prices].sort((a, b) => a.amount - b.amount)[0]?.interval) : null;
  if (plan && !allowsMemberType(plan, core.member_type)) throw httpError(422, `Plan ${plan.name} is not open to ${core.member_type.toLowerCase()} members`);
  const fieldDefs = await anyFields(Object.keys(values), core.member_type);

  const id = await prisma.$transaction(
    async (tx) => {
      const { member } = await createAccount(tx, { ...core, password: randomPassword() });
      await saveFieldValues(tx, member.id, values, fieldDefs);
      for (const [i, c] of contacts.entries()) await tx.membershipContact.create({ data: { ...c, member_id: member.id, is_primary: i === 0 } });
      await recordEvent(tx, { key: 'member.added', member_id: member.id, actor, data: { offline: true, plan: plan?.slug ?? null, complimentary: !!complimentary }, description: `${member.full_name} added by an admin` });
      if (plan) {
        const sub = await createSubscription(tx, { member, plan, price, status: 'PENDING_PAYMENT' });
        if (complimentary || plan.is_free) await activate(tx, sub.id, { actor, approvedBy: actor, startsAt: starts_at });
      }
      return member.id;
    },
    { timeout: 30_000 }
  );
  return getMember(id);
}

export async function updateMember(id, { fields: values, ...body }, actor) {
  const m = await must(id);
  await prisma.$transaction(async (tx) => {
    if (body.email && body.email !== m.email) {
      if (await tx.user.findFirst({ where: { email: body.email, id: { not: m.user_id } } })) throw httpError(409, 'Email already in use');
      await tx.user.update({ where: { id: m.user_id }, data: { email: body.email } });
    }
    if (Object.keys(body).length) await tx.member.update({ where: { id }, data: body });
    if (values) await saveFieldValues(tx, id, values, await anyFields(Object.keys(values), body.member_type ?? m.member_type));
    await recordEvent(tx, { key: 'member.updated', member_id: id, actor, data: { fields: [...Object.keys(body), ...(values ? ['fields'] : [])] }, description: 'Member updated by an admin' });
  });
  return getMember(id);
}

// ---------- actions ----------

const needCurrent = async (member) => {
  const sub = await currentSubscription(member.id);
  if (!sub) throw httpError(409, 'Member has no subscription');
  return sub;
};

export async function extend(id, { days, until }, actor) {
  const m = await must(id);
  const sub = await needCurrent(m);
  if (!['ACTIVE', 'PAST_DUE', 'EXPIRED', 'TRIALING'].includes(sub.status)) throw httpError(409, `Cannot extend a ${sub.status} subscription`);
  if (!sub.ends_at && sub.status === 'ACTIVE') throw httpError(409, 'Lifetime memberships do not expire');
  const now = new Date();
  const base = sub.ends_at && sub.ends_at > now ? sub.ends_at : now;
  const ends = until ?? new Date(base.getTime() + days * 86_400_000);
  await prisma.$transaction(async (tx) => {
    if (sub.status === 'ACTIVE') {
      await tx.membershipSubscription.update({ where: { id: sub.id }, data: { ends_at: ends, grace_ends_at: null } });
      await recordEvent(tx, { key: 'subscription.extended', member_id: id, actor, data: { subscription_id: sub.id, ends_at: ends }, description: 'Membership extended' });
    } else await setStatus(tx, sub, 'ACTIVE', { ends_at: ends, grace_ends_at: null }, { actor, key: 'subscription.extended' });
  });
  return getMember(id);
}

/** Admin switch: immediate, no payment, no pro-rata. Use record-payment to take money. */
export async function changePlan(id, { plan_id, plan_slug, interval }, actor) {
  const m = await must(id);
  const plan = await resolvePlan({ plan_id, plan_slug });
  const price = pickPrice(plan, interval);
  const cur = await currentSubscription(id);
  await prisma.$transaction(async (tx) => {
    if (cur && LIVE.includes(cur.status)) {
      await tx.membershipSubscription.update({ where: { id: cur.id }, data: { plan_id: plan.id, price_id: price?.id ?? null, pending_plan_id: null } });
      await recordEvent(tx, { key: 'subscription.plan_changed', member_id: id, actor, data: { subscription_id: cur.id, from: cur.plan.slug, to: plan.slug }, description: `Plan changed to ${plan.name}` });
    } else {
      const sub = await createSubscription(tx, { member: m, plan, price, status: 'PENDING_PAYMENT' });
      await activate(tx, sub.id, { actor, approvedBy: actor });
    }
  });
  return getMember(id);
}

export async function suspend(id, reason, actor) {
  const sub = await needCurrent(await must(id));
  await prisma.$transaction((tx) => setStatus(tx, sub, 'SUSPENDED', { suspended_reason: reason ?? null }, { actor, key: 'subscription.suspended' }));
  return getMember(id);
}

export async function reactivate(id, actor) {
  const sub = await needCurrent(await must(id));
  await prisma.$transaction((tx) => setStatus(tx, sub, 'ACTIVE', { suspended_reason: null }, { actor, key: 'subscription.reactivated' }));
  return getMember(id);
}

export async function cancelMember(id, body, actor) {
  await cancelOwn(await must(id), body, actor);
  return getMember(id);
}

/** An offline payment (cash, cheque, transfer) taken by an admin: PAID at once, invoiced, activates. */
export async function recordPayment(id, { amount, method, utr, note, plan_id, interval }, actor) {
  const m = await must(id);
  let sub = await currentSubscription(id);
  if (plan_id) {
    const plan = await resolvePlan({ plan_id });
    const price = pickPrice(plan, interval);
    if (!sub || sub.plan_id !== plan.id || !['PENDING_PAYMENT', ...LIVE, 'EXPIRED'].includes(sub.status))
      sub = await prisma.$transaction((tx) => createSubscription(tx, { member: m, plan, price, status: 'PENDING_PAYMENT' }));
  }
  if (!sub) throw httpError(422, 'Give plan_id and interval: this member has no subscription yet');
  if (!sub.price) throw httpError(422, 'This plan is free: nothing to pay');
  const q = calcPrice(sub.price);
  const total = amount ?? q.total;
  const payment = await prisma.$transaction((tx) =>
    createPayment(tx, { member: m, subscription: sub, amount: total, tax_amount: total === q.total ? q.tax : taxPortionOfTotal(total, sub.price.gst_rate), currency: sub.price.currency, status: 'UNDER_VERIFICATION' })
  );
  await prisma.membershipPayment.update({ where: { id: payment.id }, data: { utr: utr ?? null, note: [method, note].filter(Boolean).join(': ') || null } });
  await markPaid(payment.id, { actor, verified: true });
  return getMember(id);
}

export async function setNotes(id, notes, actor) {
  await must(id);
  await prisma.member.update({ where: { id }, data: { notes } });
  await recordEvent(prisma, { key: 'member.note_saved', member_id: id, actor, data: {}, description: 'Member notes saved' });
  return getMember(id);
}

// contacts: same rules as the member area, addressed by member id
export const adminContacts = async (id) => (await must(id), listContacts(id));
export const adminAddContact = async (id, body, actor) => addContact(await must(id), body, actor);
export const adminUpdateContact = async (id, cid, body, actor) => updateContact(await must(id), cid, body, actor);
export const adminRemoveContact = async (id, cid, actor) => removeContact(await must(id), cid, actor);

export async function activity(id, q) {
  await must(id);
  return listResult(q, (p) => prisma.membershipEvent.findMany({ where: { member_id: id }, orderBy: { created_at: 'desc' }, ...p }), () => prisma.membershipEvent.count({ where: { member_id: id } }));
}

// ---------- bulk / export ----------

const CSV_COLS = ['member_no', 'full_name', 'email', 'mobile', 'member_type', 'legal_name', 'gstin', 'city', 'state', 'plan', 'status', 'member_since', 'valid_till', 'tags'];
function toCsv(rows) {
  const lines = [CSV_COLS.join(',')];
  for (const r of rows.map(withCurrent))
    lines.push([r.member_no, r.full_name, r.email, r.mobile, r.member_type, r.legal_name, r.gstin, r.city, r.state, r.plan?.name, r.subscription?.status, r.member_since, r.subscription?.ends_at, r.tags.join(';')].map(csvCell).join(','));
  return lines.join('\n') + '\n';
}

export async function exportMembers(q) {
  const rows = await prisma.member.findMany({ where: buildWhere(q), include: listInclude, orderBy: { created_at: 'desc' }, take: 10_000 });
  return toCsv(rows);
}

export async function bulk({ ids, action, tags = [], remove, plan_id, interval }, actor) {
  if (action === 'export') {
    const rows = await prisma.member.findMany({ where: { id: { in: ids } }, include: listInclude });
    return { count: rows.length, csv: toCsv(rows) };
  }
  if (action === 'tag') {
    if (!tags.length) throw httpError(422, 'tags is required');
    const members = await prisma.member.findMany({ where: { id: { in: ids } }, select: { id: true, tags: true } });
    await prisma.$transaction(
      members.map((m) => prisma.member.update({ where: { id: m.id }, data: { tags: remove ? m.tags.filter((t) => !tags.includes(t)) : [...new Set([...m.tags, ...tags])] } }))
    );
    await recordEvent(prisma, { key: 'member.bulk_tagged', actor, data: { count: members.length, tags, remove: !!remove }, description: `Bulk ${remove ? 'untag' : 'tag'} of ${members.length} members` });
    return { count: members.length };
  }
  if (!plan_id || !interval) throw httpError(422, 'plan_id and interval are required');
  const failed = [];
  let done = 0;
  for (const id of ids) {
    try {
      await changePlan(id, { plan_id, interval }, actor);
      done++;
    } catch (e) {
      failed.push({ id, error: e.message });
    }
  }
  return { count: done, failed };
}

// ---------- import ----------

/** Rows are the parsed CSV (header -> value); mapping says which column feeds which member field. */
function mapRows(rows, mapping) {
  const seen = new Set();
  return rows.map((raw, i) => {
    const mapped = {};
    for (const [col, field] of Object.entries(mapping)) if (field) mapped[field] = raw[col];
    const parsed = importRowSchema.safeParse(mapped);
    const errors = parsed.success ? [] : parsed.error.issues.map((x) => `${x.path.join('.')}: ${x.message}`);
    const email = parsed.success ? parsed.data.email : String(mapped.email ?? '').toLowerCase();
    if (email && seen.has(email)) errors.push('email: duplicate in this file');
    if (email) seen.add(email);
    return { row: i + 1, data: parsed.success ? parsed.data : mapped, errors };
  });
}

export async function importPreview({ rows, mapping }) {
  const mapped = mapRows(rows, mapping);
  const emails = mapped.filter((r) => !r.errors.length).map((r) => r.data.email);
  const existing = new Set((await prisma.user.findMany({ where: { email: { in: emails } }, select: { email: true } })).map((u) => u.email));
  for (const r of mapped) if (!r.errors.length && existing.has(r.data.email)) r.errors.push('email: already registered');
  const valid = mapped.filter((r) => !r.errors.length).length;
  return { total: mapped.length, valid, invalid: mapped.length - valid, rows: mapped.slice(0, 500) };
}

export async function importCommit({ rows, mapping, plan_slug, member_type }, actor) {
  const plan = plan_slug ? await getPlanBySlug(plan_slug) : null;
  const price = plan?.is_free === false ? pickPrice(plan, 'YEARLY') : null;
  const out = { created: 0, skipped: 0, errors: [] };
  // ponytail: one transaction per row (bcrypt cost makes ~4 rows/s); move to a BullMQ job for big files
  for (const r of mapRows(rows, mapping)) {
    if (r.errors.length) {
      out.skipped++;
      out.errors.push({ row: r.row, errors: r.errors });
      continue;
    }
    try {
      await prisma.$transaction(
        async (tx) => {
          const data = { ...r.data, member_type: member_type ?? r.data.member_type };
          const { member } = await createAccount(tx, { ...data, password: randomPassword() });
          await recordEvent(tx, { key: 'member.imported', member_id: member.id, actor, data: { row: r.row }, description: `${member.full_name} imported` });
          if (plan) {
            const sub = await createSubscription(tx, { member, plan, price, status: 'PENDING_PAYMENT' });
            await activate(tx, sub.id, { actor, approvedBy: actor });
          }
        },
        { timeout: 30_000 }
      );
      out.created++;
    } catch (e) {
      out.skipped++;
      out.errors.push({ row: r.row, errors: [e.message] });
    }
  }
  return out;
}
