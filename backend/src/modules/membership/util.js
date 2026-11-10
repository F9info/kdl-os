import { prisma } from '../../config/database.js';
import { writeActivityAsync } from '../user-management/shared/activity-logger.js';

export function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

export const notFound = (what) => httpError(404, `${what} not found`);

/** ?page=&limit= -> prisma skip/take + the echo fields of the list envelope. */
export function paging(q = {}) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 20));
  return { page, limit, skip: (page - 1) * limit, take: limit };
}

export async function listResult(q, findMany, count) {
  const p = paging(q);
  const [items, total] = await Promise.all([findMany({ skip: p.skip, take: p.take }), count()]);
  return { items, total, page: p.page, limit: p.limit };
}

/** ?sort=field | -field | field:desc, restricted to `allowed`. */
export function orderBy(sort, allowed, fallback = { created_at: 'desc' }) {
  if (!sort) return fallback;
  const [rawField, dir] = String(sort).startsWith('-') ? [String(sort).slice(1), 'desc'] : String(sort).split(':');
  return allowed.includes(rawField) ? { [rawField]: dir === 'desc' ? 'desc' : 'asc' } : fallback;
}

/** Audit trail for one state change: the member timeline (MembershipEvent) + the admin activity log. */
export async function recordEvent(db, { key, member_id = null, actor = null, data = {}, description }) {
  await (db ?? prisma).membershipEvent.create({ data: { key, member_id, actor_id: actor, data } });
  writeActivityAsync({
    actor,
    module: 'membership',
    action: key,
    subject_type: 'Member',
    subject_id: member_id,
    description: description ?? key,
    properties: data,
  });
}

export const bool = (v) => v === true || v === 'true' || v === '1';
export const csvCell = (v) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  const safe = /^[=+\-@]/.test(s) ? "'" + s : s; // spreadsheet formula injection
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
