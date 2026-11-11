// Event -> channels. emitMembershipEvent() only enqueues; the worker expands the event into one log row and one
// job per channel (jobId event_id:CHANNEL), so a failing WhatsApp never blocks In-App or Email, and re-emitting
// the same event_id sends nothing twice.
import crypto from 'node:crypto';
import { prisma } from '../../../config/database.js';
import { redis } from '../../../config/redis.js';
import { logger } from '../../../shared/utils/logger.js';
import { CHANNELS, prefCategoryOf } from './events.js';
import { buildVars, istDayDiff, maskContact, renderStrict, toE164 } from './render.js';
import { getCommSettings } from './settings.js';
import { ensureCommSeed } from './seed.js';
import { contextFor } from './context.js';
import { commEventsFor } from './eventmap.js';

// BullMQ job ids cannot contain ':'; the logical id shown to admins stays event_id:CHANNEL
const jid = (...parts) => parts.join('-').replace(/:/g, '_');
const getQueue = async () => (await import('./queue.js')).commQueue;
const EXTERNAL = ['EMAIL', 'WHATSAPP', 'SMS'];
const FINAL = ['SENT', 'DELIVERED', 'READ', 'CANCELLED'];

export const newEventId = () => `evt_${crypto.randomBytes(6).toString('hex')}`;

/**
 * Fire-and-forget. Never throws into the caller's flow.
 * @param {string} key comm event key (payment.succeeded)
 * @param {string} memberId
 * @param {object} data event data (payment_id, subscription_id, reason, ...)
 * @param {string} [eventId] idempotency key; same id = same message
 * @param {{channels?: string[], verifyRow?: string, delay?: number}} [opts] verifyRow: MembershipEvent id that must exist
 *   when the job runs (the emitting transaction may have rolled back)
 */
export async function emitMembershipEvent(key, memberId, data = {}, eventId = null, opts = {}) {
  try {
    const event_id = eventId ?? newEventId();
    const q = await getQueue();
    await q.add('expand', { key, member_id: memberId, data, event_id, channels: opts.channels ?? null, verify_row: opts.verifyRow ?? null }, { jobId: jid(event_id, 'expand'), delay: opts.delay ?? 0 });
    return event_id;
  } catch (err) {
    logger.error(`membership comm: could not queue ${key}: ${err.message}`);
    return null;
  }
}

async function quietDelay(settings, category) {
  const q = settings.delivery?.quiet_hours;
  if (!q?.enabled || category === 'security') return 0;
  const [sh, sm] = q.start.split(':').map(Number);
  const [eh, em] = q.end.split(':').map(Number);
  const ist = new Date(Date.now() + 5.5 * 3_600_000);
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  const s = sh * 60 + sm;
  const e = eh * 60 + em;
  const inQuiet = s > e ? mins >= s || mins < e : mins >= s && mins < e;
  if (!inQuiet) return 0;
  const wait = mins < e ? e - mins : 24 * 60 - mins + e;
  return wait * 60_000;
}

async function memberLang(memberId, settings) {
  const row = await prisma.membershipSetting.findUnique({ where: { key: `memlang:${memberId}` } });
  return row?.value && settings.languages.available.includes(row.value) ? row.value : settings.languages.default;
}

async function pickTemplate(event_key, channel, lang) {
  const tpl = await prisma.membershipCommTemplate.findUnique({ where: { event_key_channel_lang: { event_key, channel, lang } } });
  if (tpl?.is_active) return tpl;
  if (lang === 'en') return null;
  const en = await prisma.membershipCommTemplate.findUnique({ where: { event_key_channel_lang: { event_key, channel, lang: 'en' } } });
  return en?.is_active ? en : null;
}

/** Why a channel is not used for this member (null = go ahead). Pure enough to unit test. */
export function skipReason({ channel, event, settings, member, pref }) {
  if (!settings[channel === 'IN_APP' ? 'in_app' : channel.toLowerCase()]?.enabled) return `${channel} is switched off in Communication settings`;
  if (channel === 'WHATSAPP' && settings.whatsapp.opt_in_required && !member.whatsapp_opt_in) return 'No WhatsApp opt-in';
  if (!event.is_mandatory && pref === false) return 'Member turned this off in their preferences';
  if (channel === 'WHATSAPP' && pref === false) return 'Member turned WhatsApp off in their preferences';
  return null;
}

/** Worker: one event -> log rows + channel jobs. */
export async function expandEvent({ key, member_id, data = {}, event_id, channels, verify_row }) {
  if (verify_row && !(await prisma.membershipEvent.findUnique({ where: { id: verify_row }, select: { id: true } }))) return { skipped: 'rolled back' };
  await ensureCommSeed();
  const event = await prisma.membershipCommEvent.findUnique({ where: { key } });
  if (!event) return { skipped: 'unknown event' };
  const member = await prisma.member.findUnique({ where: { id: member_id } });
  if (!member) return { skipped: 'no member' };
  const settings = await getCommSettings();
  const lang = await memberLang(member.id, settings);
  const ctx = await contextFor(member, data);
  const siteUrl = (settings.company.website_url || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const vars = buildVars({ member, ...ctx, company: settings.company, siteUrl, extra: data.vars ?? {} });
  const category = prefCategoryOf(event);
  const prefs = await prisma.membershipCommPreference.findMany({ where: { member_id, category } });
  const prefOf = (ch) => prefs.find((p) => p.channel === ch)?.enabled;
  const q = await getQueue();
  const out = [];

  for (const channel of CHANNELS) {
    if (!event.channels?.[channel]) continue;
    if (channels && !channels.includes(channel)) continue;
    const base = { event_id, event_key: key, channel, lang, member_id, data: { ...vars } };
    const exists = await prisma.membershipCommLog.findUnique({ where: { event_id_channel: { event_id, channel } } });
    if (exists) continue; // already handled: idempotent

    const cancel = (reason, recipient = null) => prisma.membershipCommLog.create({ data: { ...base, recipient: maskContact(recipient), status: 'CANCELLED', error: reason } }).catch(() => null);
    const why = skipReason({ channel, event, settings, member, pref: prefOf(channel) });
    if (why) {
      await cancel(why);
      continue;
    }
    const to = channel === 'IN_APP' ? member.user_id : channel === 'EMAIL' ? member.email : toE164(member.mobile, settings.whatsapp.default_country_code);
    if (!to) {
      await cancel(channel === 'EMAIL' ? 'Member has no email address' : 'Member has no valid mobile number (E.164)');
      continue;
    }
    const tpl = await pickTemplate(key, channel, lang);
    if (!tpl) {
      await cancel('No active template for this channel');
      continue;
    }
    const subject = renderStrict(tpl.title ?? '', vars);
    const body = renderStrict(tpl.body, vars, { html: channel === 'EMAIL' });
    const missing = [...new Set([...subject.missing, ...body.missing])];
    if (missing.length && settings.delivery.block_unresolved) {
      await prisma.membershipCommLog.create({ data: { ...base, recipient: maskContact(channel === 'IN_APP' ? null : to), status: 'FAILED', subject: tpl.title, body: tpl.body, error: `Unresolved variable: ${missing.join(', ')}. Nothing was sent.` } }).catch(() => null);
      continue;
    }
    let log;
    try {
      log = await prisma.membershipCommLog.create({ data: { ...base, recipient: channel === 'IN_APP' ? 'In-app inbox' : maskContact(to), status: 'PENDING', subject: subject.text || null, body: body.text } });
    } catch (e) {
      if (e.code === 'P2002') continue;
      throw e;
    }
    const delay = channel === 'WHATSAPP' ? await quietDelay(settings, category) : 0;
    await q.add('deliver', { log_id: log.id, meta: { link: tpl.link_url, icon: tpl.icon, toast: tpl.toast } }, { jobId: jid(event_id, channel), delay, attempts: Math.max(1, settings.delivery.retry_attempts) });
    out.push(channel);
  }
  return { channels: out };
}

async function publish(userId, payload) {
  await redis.publish(`notif:user:${userId}`, JSON.stringify(payload)).catch((e) => logger.warn(`membership comm: redis publish failed: ${e.message}`));
}

/** Worker: deliver one channel. Throws on a temporary failure so BullMQ retries; the final failure is recorded. */
export async function deliverLog({ log_id, meta = {} }, { attemptsMade = 0, maxAttempts = 3 } = {}) {
  const log = await prisma.membershipCommLog.findUnique({ where: { id: log_id } });
  if (!log || FINAL.includes(log.status)) return { skipped: true };
  const member = await prisma.member.findUnique({ where: { id: log.member_id } });
  await prisma.membershipCommLog.update({ where: { id: log.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
  const last = attemptsMade + 1 >= maxAttempts;
  try {
    if (log.channel === 'IN_APP') {
      const n = await prisma.notification.create({
        data: { user_id: member.user_id, category_slug: 'membership', title: log.subject ?? '', body: log.body, data: { url: meta.link ?? '/membership/account', icon: meta.icon ?? null, toast: !!meta.toast, event: log.event_key } },
      });
      await prisma.membershipCommLog.update({ where: { id: log.id }, data: { status: 'SENT', sent_at: new Date(), notification_id: n.id, error: null } });
      await publish(member.user_id, { id: n.id, title: n.title, body: n.body, data: n.data, created_at: n.created_at });
      return { sent: true };
    }
    const settings = await getCommSettings();
    const to = log.channel === 'EMAIL' ? member.email : toE164(member.mobile, settings.whatsapp.default_country_code);
    if (!to) throw Object.assign(new Error('No recipient'), { permanent: true });
    const { dispatchMessage } = await import('../../integrations/service.js');
    // The integrations module owns providers, fallback, rate limits and delivery webhooks. We keep its log id
    // in provider_ref and mirror its status (see syncStatuses).
    const r = await dispatchMessage({ channel: log.channel, to, subject: log.subject, body: log.body, source: `membership.${log.event_key}`, meta: { member_id: member.id } });
    await prisma.membershipCommLog.update({ where: { id: log.id }, data: { status: 'SENT', sent_at: new Date(), provider_ref: r.logId, error: null } });
    return { sent: true };
  } catch (err) {
    const permanent = err.permanent || err.name === 'IntegrationsDisabledError';
    const final = permanent || last;
    await prisma.membershipCommLog.update({ where: { id: log.id }, data: { status: final ? 'FAILED' : 'PENDING', error: String(err.message).slice(0, 400) } });
    if (!final) throw err;
    logger.warn(`membership comm: ${log.channel} ${log.event_id} failed: ${err.message}`);
    return { failed: true };
  }
}

/** Mirror core IntegrationLog statuses (DELIVERED / READ / FAILED + provider message id) onto our rows. */
export async function syncStatuses(rows) {
  const ext = rows.filter((r) => EXTERNAL.includes(r.channel) && r.provider_ref && ['SENT', 'PROCESSING', 'DELIVERED'].includes(r.status));
  if (!ext.length) return rows;
  const logs = await prisma.integrationLog.findMany({ where: { id: { in: ext.map((r) => r.provider_ref) } } });
  const by = new Map(logs.map((l) => [l.id, l]));
  for (const r of ext) {
    const l = by.get(r.provider_ref);
    if (!l) continue;
    const status = l.status === 'QUEUED' ? 'SENT' : l.status;
    const resp = l.error ?? (l.provider_ref ? `ref ${l.provider_ref}` : null);
    if (status !== r.status || resp !== r.provider_response) {
      Object.assign(r, { status, provider_response: resp, error: status === 'FAILED' ? l.error : r.error, delivered_at: l.delivered_at ?? r.delivered_at });
      await prisma.membershipCommLog.update({ where: { id: r.id }, data: { status, provider_response: resp, error: r.error, delivered_at: r.delivered_at } });
    }
  }
  return rows;
}

/** Admin retry of one failed/cancelled channel. Re-renders with the current template and the member's current contact. */
export async function retryLog(id) {
  const log = await prisma.membershipCommLog.findUnique({ where: { id } });
  if (!log) return null;
  if (!['FAILED', 'CANCELLED'].includes(log.status)) {
    const e = new Error(`Only failed or cancelled messages can be retried (this one is ${log.status})`);
    e.status = 409;
    throw e;
  }
  const settings = await getCommSettings();
  if (log.channel === 'WHATSAPP' && settings.whatsapp.opt_in_required) {
    const m = log.member_id ? await prisma.member.findUnique({ where: { id: log.member_id }, select: { whatsapp_opt_in: true } }) : null;
    if (!m?.whatsapp_opt_in) {
      const e = new Error('The member has not opted in to WhatsApp');
      e.status = 422;
      throw e;
    }
  }
  const tpl = await pickTemplate(log.event_key, log.channel, log.lang);
  if (!tpl) {
    const e = new Error('No active template for this channel');
    e.status = 422;
    throw e;
  }
  const subject = renderStrict(tpl.title ?? '', log.data);
  const body = renderStrict(tpl.body, log.data, { html: log.channel === 'EMAIL' });
  const missing = [...new Set([...subject.missing, ...body.missing])];
  if (missing.length) {
    const e = new Error(`Unresolved variable: ${missing.join(', ')}`);
    e.status = 422;
    throw e;
  }
  const q = await getQueue();
  await prisma.membershipCommLog.update({ where: { id }, data: { status: 'PENDING', error: null, subject: subject.text || null, body: body.text } });
  // new job id: the original id is spent
  await q.add('deliver', { log_id: id, meta: { link: tpl.link_url, icon: tpl.icon, toast: tpl.toast } }, { jobId: jid(log.event_id, log.channel, `r${Date.now()}`), attempts: Math.max(1, settings.delivery.retry_attempts) });
  return prisma.membershipCommLog.findUnique({ where: { id } });
}

export { istDayDiff };

/** Hook used by util.recordEvent for every audit event: queue one job, map it to comm events in the worker. */
export async function emitInternal(rowId, key, memberId, actor, data) {
  if (!memberId) return null;
  try {
    const q = await getQueue();
    // delay: the emitting transaction may still be open; verify_row makes the job a no-op if it rolled back
    await q.add('internal', { row_id: rowId, key, member_id: memberId, actor, data }, { jobId: jid(rowId, 'internal'), delay: 2000 });
    return rowId;
  } catch (err) {
    logger.error(`membership comm: could not queue ${key}: ${err.message}`);
    return null;
  }
}

export async function expandInternal({ row_id, key, member_id, actor, data }) {
  if (!(await prisma.membershipEvent.findUnique({ where: { id: row_id }, select: { id: true } }))) return { skipped: 'rolled back' };
  const member = await prisma.member.findUnique({ where: { id: member_id }, select: { user_id: true } });
  if (!member) return { skipped: 'no member' };
  const list = commEventsFor(key, data, { self: !actor || actor === member.user_id });
  const results = [];
  for (const [i, ev] of list.entries()) {
    results.push(await expandEvent({ key: ev.key, member_id, data: { ...data, ...ev.data, vars: { ...(data.vars ?? {}), ...(ev.data?.vars ?? {}) } }, event_id: i === 0 ? `evt_${row_id}` : `evt_${row_id}~${ev.key}` }));
  }
  return results;
}
