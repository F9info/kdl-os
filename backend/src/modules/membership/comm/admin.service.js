import { prisma } from '../../../config/database.js';
import { GROUPS, LANGS, VARIABLES, varsIn } from './events.js';
import { ensureCommSeed } from './seed.js';
import { fmtDate, istDayDiff, maskContact, renderStrict, toE164 } from './render.js';
import { getCommSettings, putCommSettings } from './settings.js';
import { retryLog, syncStatuses } from './dispatch.js';
import { httpError, listResult, notFound, recordEvent } from '../util.js';
import { csvCell } from '../util.js';

const CH = ['IN_APP', 'WHATSAPP', 'EMAIL', 'SMS'];
const MANDATORY_LOCKED = ['IN_APP', 'EMAIL'];

// ---------- events ----------

export async function listEvents() {
  await ensureCommSeed();
  const rows = await prisma.membershipCommEvent.findMany({ orderBy: { sort: 'asc' } });
  const items = rows.map((e) => ({ ...e, label: e.name, mandatory: e.is_mandatory, group_label: GROUPS[e.group_key] ?? 'Custom', group: GROUPS[e.group_key] ?? 'Custom', locked_channels: e.is_mandatory ? MANDATORY_LOCKED : [] }));
  const on = (c) => items.filter((e) => e.channels?.[c]).length;
  return {
    items,
    groups: Object.entries(GROUPS).map(([key, name]) => ({ key, name, count: items.filter((e) => e.group_key === key).length })),
    summary: { total: items.length, in_app_on: on('IN_APP'), whatsapp_on: on('WHATSAPP'), email_on: on('EMAIL'), sms_on: on('SMS'), mandatory: items.filter((e) => e.is_mandatory).length },
  };
}

export async function setEventChannel(key, { channel, enabled }, actor) {
  const e = await prisma.membershipCommEvent.findUnique({ where: { key } });
  if (!e) throw notFound('Event');
  if (!enabled && e.is_mandatory && MANDATORY_LOCKED.includes(channel)) throw httpError(409, `${channel === 'IN_APP' ? 'In-App' : 'Email'} is mandatory for this event and cannot be switched off`);
  const row = await prisma.membershipCommEvent.update({ where: { key }, data: { channels: { ...(e.channels ?? {}), [channel]: enabled } } });
  await recordEvent(prisma, { key: 'comm.event_switched', actor, data: { event: key, channel, enabled }, description: `${key}: ${channel} ${enabled ? 'on' : 'off'}` });
  return row;
}

export async function createCustomEvent({ key, name, description, group_key = 'F', category = 'transactional' }, actor) {
  if (await prisma.membershipCommEvent.findUnique({ where: { key } })) throw httpError(409, 'An event with this key already exists');
  const max = await prisma.membershipCommEvent.aggregate({ _max: { sort: true } });
  const row = await prisma.membershipCommEvent.create({ data: { key, name, description: description ?? name, group_key, category, is_custom: true, is_mandatory: category !== 'transactional', sort: (max._max.sort ?? 0) + 1, channels: { IN_APP: true, WHATSAPP: false, EMAIL: true, SMS: false } } });
  await prisma.membershipCommTemplate.createMany({
    data: [
      { event_key: key, channel: 'IN_APP', lang: 'en', title: name, body: `${name}: {{member_name}}`, link_url: '/membership/account' },
      { event_key: key, channel: 'EMAIL', lang: 'en', title: name, body: `<p>Hi {{member_name}},</p><p>${name}</p><p>— {{company_name}}</p>` },
    ],
  });
  await recordEvent(prisma, { key: 'comm.event_created', actor, data: { event: key }, description: `Custom event ${key} created` });
  return row;
}

// ---------- templates ----------

export async function listTemplates(q = {}) {
  await ensureCommSeed();
  const events = await prisma.membershipCommEvent.findMany({ orderBy: { sort: 'asc' }, where: q.group ? { group_key: q.group } : {} });
  const tpls = await prisma.membershipCommTemplate.findMany();
  const matching = events.filter((e) => !q.q || `${e.name} ${e.key}`.toLowerCase().includes(String(q.q).toLowerCase()));
  const items = matching
    .map((e) => {
      const mine = tpls.filter((t) => t.event_key === e.key && (!q.channel || t.channel === q.channel) && (!q.lang || t.lang === q.lang));
      return {
        event: e.key, label: e.name, key: e.key, name: e.name, group_key: e.group_key, group: GROUPS[e.group_key] ?? 'Custom', is_mandatory: e.is_mandatory,
        channels: [...new Set(mine.filter((t) => t.is_active).map((t) => t.channel))],
        languages: [...new Set(mine.map((t) => t.lang))],
        updated_at: mine.reduce((m, t) => (t.updated_at > m ? t.updated_at : m), new Date(0)),
        _n: mine.length,
      };
    })
    .filter((i) => i._n > 0)
    .map(({ _n, ...i }) => i);
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 20));
  return { items: items.slice((page - 1) * limit, page * limit), total: items.length, page, limit };
}

const SAMPLE = {
  member_name: 'Suresh Varma', member_email: 'suresh.varma@example.com', member_phone: '+919848012345', membership_name: 'Gold', membership_plan: 'Gold · Yearly', membership_id: 'KDL-M-2026-00513',
  membership_status: 'Active', start_date: '07 Nov 2026', expiry_date: '06 Nov 2027', renewal_date: '06 Nov 2027', amount: '₹5,898.82', currency: 'INR', transaction_id: 'pay_Q8f2LxA91kZ',
  payment_status: 'Paid', payment_date: '07 Nov 2026', invoice_url: 'https://example.com/invoice/demo', cancellation_date: '06 Nov 2027', support_email: 'support@example.com', company_name: 'Your organisation',
  company_logo: 'https://example.com/logo.png', website_url: 'https://example.com/membership/account', days_left: 'in 7 days', reason: 'Card declined', refund_amount: '₹5,898.82', invoice_number: 'MEM/2026-27/00413',
  old_plan: 'Silver', new_plan: 'Gold', utr: 'SBIN226311458', login_time: '10 Nov 2026, 08:14 pm', device: 'Chrome on Mac', document_name: 'GST certificate', contact_name: 'Lakshmi Prasad', changed_fields: 'designation', reset_link: 'https://example.com/reset/demo',
};

export const variablesFor = async (event) => {
  const used = new Set();
  if (event) for (const t of await prisma.membershipCommTemplate.findMany({ where: { event_key: event } })) varsIn(`${t.title ?? ''} ${t.body}`).forEach((x) => used.add(x));
  return VARIABLES.map((v) => ({ ...v, label: v.description, sample: SAMPLE[v.key] ?? '', used: used.has(v.key) }));
};

function preview(t, settings) {
  const sample = { ...SAMPLE, company_name: settings.company.name, support_email: settings.company.support_email };
  const subject = renderStrict(t.title ?? '', sample);
  const body = renderStrict(t.body, sample, { html: t.channel === 'EMAIL' });
  return { title: subject.text, body: body.text, missing: [...new Set([...subject.missing, ...body.missing])] };
}

export async function getTemplate(event_key, channel, lang) {
  await ensureCommSeed();
  const e = await prisma.membershipCommEvent.findUnique({ where: { key: event_key } });
  if (!e) throw notFound('Event');
  const settings = await getCommSettings();
  const t = await prisma.membershipCommTemplate.findUnique({ where: { event_key_channel_lang: { event_key, channel, lang } } });
  const skeleton = t ?? { id: null, event_key, channel, lang, title: '', body: '', is_active: false, attachments: [], wa_params: [], exists: false };
  const langs = await prisma.membershipCommTemplate.findMany({ where: { event_key, channel }, select: { lang: true } });
  const wp = skeleton.wa_params ?? [];
  return {
    ...skeleton, exists: !!t,
    // A4 field names next to the stored ones
    enabled: !!skeleton.is_active, message: skeleton.body, link: skeleton.link_url, subject: skeleton.title,
    reply_to: settings.email.reply_to || settings.company.support_email,
    wa_category: 'Utility', wa_status: skeleton.wa_template_name ? 'APPROVED' : null,
    wa_fields: Object.fromEntries(wp.map((v, i) => [String(i + 1), v])),
    wa_button_label: skeleton.wa_button?.text ?? null, wa_button_url: skeleton.wa_button?.url ?? null, event: { key: e.key, name: e.name, description: e.description, is_mandatory: e.is_mandatory, category: e.category, channels: e.channels },
    languages: LANGS.map((l) => ({ lang: l, exists: langs.some((x) => x.lang === l) })),
    preview: t ? preview(t, settings) : null,
    from: `${settings.email.sender_name || settings.company.name}${settings.email.sender_email ? ` <${settings.email.sender_email}>` : ''}`,
  };
}

const stripScripts = (h) => String(h ?? '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');

export async function putTemplate(event_key, channel, lang, input, actor) {
  const body = {
    ...input,
    title: input.title ?? input.subject ?? null,
    body: input.body ?? input.message,
    link_url: input.link_url ?? input.link ?? null,
    is_active: input.is_active ?? input.enabled,
    wa_params: input.wa_params ?? (input.wa_fields ? Object.entries(input.wa_fields).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v) : undefined),
    wa_button: input.wa_button_label || input.wa_button_url ? { text: input.wa_button_label ?? '', url: input.wa_button_url ?? '' } : undefined,
  };
  const e = await prisma.membershipCommEvent.findUnique({ where: { key: event_key } });
  if (!e) throw notFound('Event');
  const text = channel === 'EMAIL' ? stripScripts(body.body) : body.body;
  const unknown = varsIn(`${body.title ?? ''} ${text}`).filter((v) => !VARIABLES.some((x) => x.key === v));
  if (unknown.length) throw httpError(422, `Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{{${u}}}`).join(', ')}`);
  if (channel === 'WHATSAPP' && lang === 'en' && body.wa_template_name === '') throw httpError(422, 'An approved WhatsApp template name is required');
  const data = {
    title: body.title ?? null, preheader: body.preheader ?? null, body: text, wa_template_name: body.wa_template_name ?? null,
    wa_params: body.wa_params ?? (channel === 'WHATSAPP' ? varsIn(text) : undefined), wa_button: body.wa_button ?? undefined,
    link_url: body.link_url ?? null, icon: body.icon ?? null, toast: body.toast ?? false, attachments: body.attachments ?? [], is_active: body.is_active ?? true, updated_by: actor,
  };
  const row = await prisma.membershipCommTemplate.upsert({ where: { event_key_channel_lang: { event_key, channel, lang } }, create: { event_key, channel, lang, ...data }, update: data });
  await recordEvent(prisma, { key: 'comm.template_saved', actor, data: { event: event_key, channel, lang }, description: `Template ${event_key} ${channel} ${lang} saved` });
  return getTemplate(event_key, channel, lang);
}

export async function testSend(event_key, channel, lang, { to }, actor) {
  const t = await prisma.membershipCommTemplate.findUnique({ where: { event_key_channel_lang: { event_key, channel, lang } } });
  if (!t) throw notFound('Template');
  const settings = await getCommSettings();
  const p = preview(t, settings);
  if (channel === 'IN_APP') {
    const n = await prisma.notification.create({ data: { user_id: actor, category_slug: 'membership', title: `[Test] ${p.title}`, body: p.body, data: { url: t.link_url ?? '/membership/account', test: true } } });
    return { sent: true, to: 'your own notification bell', notification_id: n.id };
  }
  const dest = channel === 'EMAIL' ? to : toE164(to, settings.whatsapp.default_country_code);
  if (!dest) throw httpError(422, channel === 'EMAIL' ? 'Enter an email address' : 'Enter a valid mobile number');
  const { dispatchMessage } = await import('../../integrations/service.js');
  try {
    const r = await dispatchMessage({ channel, to: dest, subject: channel === 'EMAIL' ? `[Test] ${p.title}` : undefined, body: p.body, source: 'membership.test' });
    return { sent: true, to: maskContact(dest), log_id: r.logId, unresolved: p.missing };
  } catch (err) {
    throw httpError(err.status ?? 502, err.name === 'IntegrationsDisabledError' ? 'The Integrations module is off: switch it on and add a provider' : err.message);
  }
}

// ---------- logs ----------

async function logWhere(q) {
  const and = [];
  if (q.event) and.push({ event_key: q.event });
  if (q.channel) and.push({ channel: q.channel });
  if (q.status) and.push({ status: q.status });
  if (q.member_id) and.push({ member_id: q.member_id });
  if (q.from || q.to) and.push({ created_at: { ...(q.from && { gte: q.from }), ...(q.to && { lte: q.to }) } });
  if (q.q) {
    const c = { contains: q.q, mode: 'insensitive' };
    const ms = await prisma.member.findMany({ where: { OR: [{ full_name: c }, { email: c }, { mobile: c }] }, select: { id: true }, take: 200 });
    and.push({ OR: [{ member_id: { in: ms.map((m) => m.id) } }, { event_id: c }, { provider_ref: q.q }] });
  }
  return and.length ? { AND: and } : {};
}

async function decorate(rows) {
  await syncStatuses(rows);
  const members = await prisma.member.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.member_id).filter(Boolean))] } }, select: { id: true, full_name: true, email: true } });
  const events = await prisma.membershipCommEvent.findMany({ where: { key: { in: [...new Set(rows.map((r) => r.event_key))] } }, select: { key: true, name: true } });
  return rows.map(({ data: _d, ...r }) => ({
    ...r,
    member: members.find((m) => m.id === r.member_id) ?? null,
    member_name: members.find((m) => m.id === r.member_id)?.full_name ?? null,
    event: r.event_key,
    event_label: events.find((e) => e.key === r.event_key)?.name ?? r.event_key,
    job_id: `${r.event_id}:${r.channel}`,
    retryable: ['FAILED', 'CANCELLED'].includes(r.status),
  }));
}

export async function listLogs(q) {
  const where = await logWhere(q);
  const r = await listResult(q, (p) => prisma.membershipCommLog.findMany({ where, orderBy: { created_at: 'desc' }, ...p }), () => prisma.membershipCommLog.count({ where }));
  const summary = await logSummary();
  return { ...r, items: await decorate(r.items), summary, stats: { total: summary.messages_today, delivered_pct: summary.delivered_pct, failed: summary.failed, pending: summary.pending, skipped: summary.skipped_no_opt_in } };
}

async function logSummary() {
  const since = new Date(Date.now() - 86_400_000);
  const g = await prisma.membershipCommLog.groupBy({ by: ['status'], where: { created_at: { gte: since } }, _count: { _all: true } });
  const n = (...s) => g.filter((x) => s.includes(x.status)).reduce((a, x) => a + x._count._all, 0);
  const total = g.reduce((a, x) => a + x._count._all, 0);
  const skipped = await prisma.membershipCommLog.count({ where: { created_at: { gte: since }, status: 'CANCELLED', error: { contains: 'opt-in' } } });
  const delivered = n('SENT', 'DELIVERED', 'READ');
  return { messages_today: total, delivered_pct: total ? Math.round((delivered / total) * 1000) / 10 : 0, failed: n('FAILED'), pending: n('PENDING', 'PROCESSING'), skipped_no_opt_in: skipped, failed_total: await prisma.membershipCommLog.count({ where: { status: 'FAILED' } }) };
}

export async function getLog(id) {
  const log = await prisma.membershipCommLog.findUnique({ where: { id } });
  if (!log) throw notFound('Log');
  const siblings = await prisma.membershipCommLog.findMany({ where: { event_id: log.event_id }, orderBy: { created_at: 'asc' } });
  const [one] = await decorate([log]);
  const channels = await decorate(siblings);
  const member = log.member_id ? await prisma.member.findUnique({ where: { id: log.member_id }, select: { id: true, full_name: true, email: true, mobile: true, member_no: true } }) : null;
  return { ...one, vars: log.data, member, channels, event_created_at: siblings[0]?.created_at ?? log.created_at };
}

export const retry = async (id, actor) => {
  const r = await retryLog(id);
  if (!r) throw notFound('Log');
  await recordEvent(prisma, { key: 'comm.retry', actor, data: { log_id: id }, description: `Retry of ${r.event_key} ${r.channel}` });
  return r;
};

export async function retryAllFailed(actor) {
  const rows = await prisma.membershipCommLog.findMany({ where: { status: 'FAILED' }, orderBy: { created_at: 'desc' }, take: 200 });
  let queued = 0;
  const skipped = [];
  for (const r of rows) {
    try {
      await retryLog(r.id);
      queued += 1;
    } catch (e) {
      skipped.push({ id: r.id, reason: e.message });
    }
  }
  await recordEvent(prisma, { key: 'comm.retry_all', actor, data: { queued, skipped: skipped.length }, description: `Retried ${queued} failed messages` });
  return { queued, skipped: skipped.length, reasons: skipped.slice(0, 20) };
}

export async function exportLogs(q) {
  const rows = await decorate(await prisma.membershipCommLog.findMany({ where: await logWhere(q), orderBy: { created_at: 'desc' }, take: 10_000 }));
  const head = ['time', 'member', 'event', 'channel', 'recipient', 'status', 'provider_response', 'error'];
  return [head.join(','), ...rows.map((r) => [r.created_at, r.member?.full_name, r.event_label, r.channel, r.recipient, r.status, r.provider_response, r.error].map(csvCell).join(','))].join('\n') + '\n';
}

// ---------- reminders / settings ----------

export async function getReminders() {
  const { reminders } = await getCommSettings();
  const now = new Date();
  const subs = await prisma.membershipSubscription.findMany({ where: { status: { in: ['ACTIVE', 'TRIALING'] }, cancel_at_period_end: false, ends_at: { gte: now, lte: new Date(now.getTime() + 45 * 86_400_000) } }, select: { ends_at: true, member_id: true } });
  const upcoming = [];
  for (let off = 0; off < 7; off++) {
    const day = new Date(now.getTime() + off * 86_400_000);
    for (const s of reminders.steps) {
      const members = new Set(subs.filter((x) => istDayDiff(x.ends_at, day) === s.days_before).map((x) => x.member_id)).size;
      if (members) upcoming.push({ date: fmtDate(day), iso: day.toISOString().slice(0, 10), days_before: s.days_before, members });
    }
  }
  const steps = reminders.steps.map((s) => ({ ...s, offset_days: s.days_before, channels: { IN_APP: s.in_app !== false, WHATSAPP: s.whatsapp !== false, EMAIL: s.email !== false }, template: 'renewal.reminder' }));
  const rules = { send_at: reminders.send_at, timezone: reminders.timezone, skip_if_renewed: reminders.skip_if_renewed, skip_auto_renew: reminders.skip_auto_renew, quiet_hours: (await getCommSettings()).delivery.quiet_hours };
  return { ...reminders, steps, rules, template: 'renewal.reminder', upcoming: upcoming.map((u) => ({ ...u, label: `${u.days_before} day${u.days_before === 1 ? '' : 's'} before`, count: u.members })) };
}

export async function putReminders(body, actor) {
  const cur = (await getCommSettings()).reminders;
  const norm = (body.steps ?? cur.steps).map((x) => ({ days_before: x.days_before ?? x.offset_days, in_app: x.channels?.IN_APP ?? x.in_app ?? true, whatsapp: x.channels?.WHATSAPP ?? x.whatsapp ?? true, email: x.channels?.EMAIL ?? x.email ?? true }));
  const steps = norm.sort((a, b) => b.days_before - a.days_before);
  const { rules = {} } = body;
  const flat = { send_at: rules.send_at ?? body.send_at, timezone: rules.timezone ?? body.timezone, skip_if_renewed: rules.skip_if_renewed ?? body.skip_if_renewed, skip_auto_renew: rules.skip_auto_renew ?? body.skip_auto_renew };
  await putCommSettings({ reminders: { ...Object.fromEntries(Object.entries(flat).filter(([, v]) => v !== undefined)), steps }, ...(rules.quiet_hours ? { delivery: { quiet_hours: rules.quiet_hours } } : {}) });
  try {
    const { scheduleReminders } = await import('./reminders.js');
    const { commQueue } = await import('./queue.js');
    await scheduleReminders(commQueue);
  } catch (e) {
    throw httpError(503, `Saved, but the daily job could not be rescheduled: ${e.message}`);
  }
  await recordEvent(prisma, { key: 'comm.reminders_saved', actor, data: { steps: steps.length }, description: 'Renewal reminder schedule saved' });
  return getReminders();
}

async function providerInfo() {
  const rows = await prisma.integrationProvider.findMany({ where: { is_active: true }, select: { id: true, channel: true, driver: true, name: true, is_default: true, is_fallback: true } });
  return { email: rows.filter((r) => r.channel === 'EMAIL'), whatsapp: rows.filter((r) => r.channel === 'WHATSAPP'), sms: rows.filter((r) => r.channel === 'SMS') };
}

const name = (l) => l.find((x) => x.is_default)?.name ?? l[0]?.name ?? null;
async function apiSettings() {
  const s = await getCommSettings();
  const p = await providerInfo();
  const wa = await prisma.integrationProvider.findFirst({ where: { channel: 'WHATSAPP', is_active: true, is_default: true }, select: { config: true } });
  return {
    in_app: { enabled: s.in_app.enabled, retention_days: s.in_app.retention_days, show_unread_count: s.in_app.show_unread_count, toast_online: s.in_app.toast, per_page: s.in_app.page_size },
    whatsapp: { enabled: s.whatsapp.enabled, provider: name(p.whatsapp), business_number: wa?.config?.wabaNumber ?? null, default_country_code: s.whatsapp.default_country_code, opt_in_required: s.whatsapp.opt_in_required },
    email: { enabled: s.email.enabled, provider: name(p.email), sender_name: s.email.sender_name || s.company.name, sender_email: s.email.sender_email, reply_to: s.email.reply_to || s.company.support_email, layout: s.email.layout },
    sms: { enabled: s.sms.enabled, provider: name(p.sms) },
    rules: { retry: s.delivery.retry_attempts, block_unresolved: s.delivery.block_unresolved, sms_fallback: s.sms.fallback_for_whatsapp },
    member_preferences: s.preferences.members_can_manage,
    company: s.company, languages: s.languages,
    providers: p,
  };
}

export const getSettings = apiSettings;

/** Accepts the A4 shape (in_app/whatsapp/email/rules/member_preferences) and maps it onto the stored settings. */
export async function putSettings(b, actor) {
  const patch = {};
  const set = (path, v) => {
    if (v === undefined) return;
    const [a, k] = path.split('.');
    (patch[a] ??= {})[k] = v;
  };
  if (b.in_app) for (const [k, to] of [['enabled', 'in_app.enabled'], ['retention_days', 'in_app.retention_days'], ['show_unread_count', 'in_app.show_unread_count'], ['toast_online', 'in_app.toast'], ['per_page', 'in_app.page_size']]) set(to, b.in_app[k]);
  if (b.whatsapp) for (const k of ['enabled', 'default_country_code', 'opt_in_required']) set(`whatsapp.${k}`, b.whatsapp[k]);
  if (b.email) for (const k of ['enabled', 'sender_name', 'sender_email', 'reply_to', 'layout']) set(`email.${k}`, b.email[k]);
  if (b.sms) set('sms.enabled', b.sms.enabled);
  if (b.rules) {
    set('delivery.retry_attempts', b.rules.retry);
    set('delivery.block_unresolved', b.rules.block_unresolved);
    set('sms.fallback_for_whatsapp', b.rules.sms_fallback);
  }
  if (b.member_preferences !== undefined) set('preferences.members_can_manage', typeof b.member_preferences === 'object' ? b.member_preferences.members_can_manage : b.member_preferences);
  if (b.company) patch.company = b.company;
  if (b.languages) patch.languages = b.languages;
  await putCommSettings(patch);
  await recordEvent(prisma, { key: 'comm.settings_saved', actor, data: { sections: Object.keys(b) }, description: 'Communication settings saved' });
  return apiSettings();
}

export async function testConnection(channel) {
  const p = await providerInfo();
  const list = p[channel.toLowerCase()] ?? [];
  const def = list.find((x) => x.is_default);
  return { ok: !!def, provider: def ?? null, message: def ? `Default ${channel.toLowerCase()} provider: ${def.name}` : `No active default ${channel.toLowerCase()} provider. Add one in Integrations > Providers.` };
}
