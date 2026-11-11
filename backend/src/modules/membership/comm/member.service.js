// Member side of communication: inbox (core notifications table), preferences, WhatsApp consent.
import { prisma } from '../../../config/database.js';
import { getCommSettings } from './settings.js';
import { maskContact, toE164 } from './render.js';
import { httpError, recordEvent } from '../util.js';

const CATEGORY = 'membership';
const unreadWhere = (userId) => ({ user_id: userId, category_slug: CATEGORY, read_at: null });

export const unreadCount = (member) => prisma.notification.count({ where: unreadWhere(member.user_id) }).then((unread) => ({ unread, count: unread }));

export async function listNotifications(member, q = {}) {
  const page = Math.max(1, Number(q.page) || 1);
  const settings = await getCommSettings();
  const limit = Math.min(100, Math.max(1, Number(q.limit) || settings.in_app.page_size));
  const where = { user_id: member.user_id, category_slug: CATEGORY, ...(q.unread ? { read_at: null } : {}) };
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { created_at: 'desc' }, skip: (page - 1) * limit, take: limit }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: unreadWhere(member.user_id) }),
  ]);
  const items = rows.map((n) => ({ id: n.id, title: n.title, body: n.body, url: n.data?.url ?? null, link: n.data?.url ?? null, icon: n.data?.icon ?? null, toast: !!n.data?.toast, event: n.data?.event ?? null, read: !!n.read_at, read_at: n.read_at, created_at: n.created_at }));
  return { items, total, page, limit, page_size: limit, unread, retention_days: settings.in_app.retention_days };
}

export async function markRead(member, { ids, all }) {
  const where = { user_id: member.user_id, category_slug: CATEGORY, read_at: null, ...(all ? {} : { id: { in: ids ?? [] } }) };
  const rows = await prisma.notification.findMany({ where, select: { id: true } });
  const now = new Date();
  await prisma.notification.updateMany({ where: { id: { in: rows.map((r) => r.id) } }, data: { read_at: now } });
  await prisma.membershipCommLog.updateMany({ where: { notification_id: { in: rows.map((r) => r.id) } }, data: { status: 'READ', read_at: now } });
  return { updated: rows.length, ...(await unreadCount(member)) };
}

// ---------- preferences ----------

const CATS = [
  { category: 'security', label: 'Security', description: 'Password, email or mobile changes, new logins', locked: ['IN_APP', 'EMAIL'] },
  { category: 'payments', label: 'Payments & invoices', description: 'Payment status, refunds, GST invoices', locked: ['IN_APP', 'EMAIL'] },
  { category: 'membership', label: 'Membership & renewals', description: 'Approval, renewal reminders, expiry, plan changes', locked: [] },
  { category: 'events', label: 'Events & news', description: 'Meet-ups, newsletters and offers', locked: [] },
];
const CHANNELS = ['IN_APP', 'WHATSAPP', 'EMAIL'];

export async function getPreferences(member) {
  const [rows, settings, lang] = await Promise.all([
    prisma.membershipCommPreference.findMany({ where: { member_id: member.id } }),
    getCommSettings(),
    prisma.membershipSetting.findUnique({ where: { key: `memlang:${member.id}` } }),
  ]);
  const categories = CATS.map((c) => ({
    ...c,
    key: c.category,
    channels: Object.fromEntries(CHANNELS.map((ch) => {
      const locked = c.locked.includes(ch);
      const stored = rows.find((r) => r.category === c.category && r.channel === ch)?.enabled;
      return [ch, { enabled: locked ? true : stored ?? true, locked }];
    })),
  }));
  return {
    categories,
    whatsapp: { opted_in: member.whatsapp_opt_in, opted_in_at: member.whatsapp_opt_in_at, consented_at: member.whatsapp_opt_in_at, source: member.whatsapp_opt_in_source, mobile: member.mobile ? maskContact(toE164(member.mobile, settings.whatsapp.default_country_code) ?? member.mobile) : null, enabled: settings.whatsapp.enabled },
    email: { address: member.email, unsubscribe_note: 'Marketing emails have an unsubscribe link.' },
    language: lang?.value ?? settings.languages.default,
    languages: settings.languages.available,
    members_can_manage: settings.preferences.members_can_manage,
  };
}

/** body: { preferences: { <category>: { <CHANNEL>: boolean } }, language? }. Locked cells (security, payments by In-App/Email) are ignored. */
export async function putPreferences(member, body, actor) {
  const settings = await getCommSettings();
  if (!settings.preferences.members_can_manage) throw httpError(403, 'Preferences are managed by the organisation');
  const ops = [];
  for (const [category, chans] of Object.entries(body.preferences ?? body.categories ?? {})) {
    const cat = CATS.find((c) => c.category === category);
    if (!cat) throw httpError(422, `Unknown category ${category}`);
    for (const [channel, enabled] of Object.entries(chans)) {
      if (!CHANNELS.includes(channel)) throw httpError(422, `Unknown channel ${channel}`);
      if (cat.locked.includes(channel)) continue;
      ops.push(prisma.membershipCommPreference.upsert({ where: { member_id_category_channel: { member_id: member.id, category, channel } }, create: { member_id: member.id, category, channel, enabled }, update: { enabled } }));
    }
  }
  if (body.language) {
    if (!settings.languages.available.includes(body.language)) throw httpError(422, 'Language not available');
    ops.push(prisma.membershipSetting.upsert({ where: { key: `memlang:${member.id}` }, create: { key: `memlang:${member.id}`, value: body.language }, update: { value: body.language } }));
  }
  await prisma.$transaction(ops);
  await recordEvent(prisma, { key: 'comm.preferences_saved', member_id: member.id, actor, data: {}, description: 'Member saved communication preferences' });
  return getPreferences(member);
}

export async function whatsappOptIn(member, actor, source = 'profile') {
  const settings = await getCommSettings();
  if (!toE164(member.mobile, settings.whatsapp.default_country_code)) throw httpError(422, 'Add a valid mobile number to your profile first');
  const m = await prisma.member.update({ where: { id: member.id }, data: { whatsapp_opt_in: true, whatsapp_opt_in_at: new Date(), whatsapp_opt_in_source: source } });
  await recordEvent(prisma, { key: 'comm.whatsapp_opt_in', member_id: member.id, actor, data: { source }, description: 'Member agreed to WhatsApp messages' });
  return getPreferences(m);
}

export async function whatsappOptOut(member, actor) {
  const m = await prisma.member.update({ where: { id: member.id }, data: { whatsapp_opt_in: false, whatsapp_opt_in_at: null, whatsapp_opt_in_source: null } });
  await recordEvent(prisma, { key: 'comm.whatsapp_opt_out', member_id: member.id, actor, data: {}, description: 'Member stopped WhatsApp messages' });
  return getPreferences(m);
}
