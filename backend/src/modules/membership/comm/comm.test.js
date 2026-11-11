import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../config/database.js', () => ({ prisma: {} }));
vi.mock('../../../config/redis.js', () => ({ redis: {} }));
vi.mock('../../user-management/shared/activity-logger.js', () => ({ writeActivityAsync: vi.fn() }));
vi.mock('../../auth/service.js', () => ({ hashPassword: vi.fn() }));
const { CATALOG, EVENT_COUNT, VARIABLES, defaultTemplates, varsIn } = await import('./events.js');
const { renderStrict, toE164, daysLeftText, istDayDiff, buildVars, fmtMoney } = await import('./render.js');
const { commEventsFor } = await import('./eventmap.js');
const { reminderDue, reminderEventId, stepChannels } = await import('./reminders.js');
const { skipReason } = await import('./dispatch.js');

describe('event catalogue', () => {
  it('has 44 events with unique keys and 3 default templates each, all using known variables', () => {
    expect(EVENT_COUNT).toBe(44);
    expect(new Set(CATALOG.map((e) => e.key)).size).toBe(44);
    const known = new Set(VARIABLES.map((v) => v.key));
    for (const e of CATALOG) {
      const t = defaultTemplates(e.key);
      expect(t.map((x) => x.channel).sort()).toEqual(['EMAIL', 'IN_APP', 'WHATSAPP']);
      for (const x of t) for (const v of varsIn(`${x.title ?? ''} ${x.body}`)) expect(known.has(v), `${e.key}:${v}`).toBe(true);
    }
  });
  it('payment.succeeded email follows the mockup copy', () => {
    const em = defaultTemplates('payment.succeeded').find((t) => t.channel === 'EMAIL');
    expect(em.title).toBe('Your membership payment is successful, {{member_name}}!');
    expect(em.body).toContain('Transaction ID: {{transaction_id}}');
  });
});

describe('strict rendering', () => {
  it('fills variables and reports every unresolved one', () => {
    expect(renderStrict('Hi {{a}} {{b}}', { a: 'x' })).toEqual({ text: 'Hi x ', missing: ['b'] });
    expect(renderStrict('{{a}}', { a: '' }).missing).toEqual(['a']);
  });
  it('escapes values in html but not in plain text', () => {
    expect(renderStrict('{{a}}', { a: '<b>' }, { html: true }).text).toBe('&lt;b&gt;');
    expect(renderStrict('{{a}}', { a: '<b>' }).text).toBe('<b>');
  });
  it('a default event renders fully from buildVars', () => {
    const vars = buildVars({ member: { full_name: 'A', email: 'a@x.in' }, company: { name: 'Org', support_email: 's@x.in' }, siteUrl: 'https://x.in', extra: { reason: 'r', utr: 'u', days_left: 'in 7 days', refund_amount: '1', old_plan: 'a', new_plan: 'b', device: 'd', document_name: 'doc', contact_name: 'c', reset_link: 'l' } });
    for (const e of CATALOG) for (const t of defaultTemplates(e.key)) expect(renderStrict(`${t.title ?? ''}${t.body}`, vars).missing, e.key).toEqual([]);
  });
});

describe('phone numbers', () => {
  it('normalises to E.164 with +91 by default and rejects junk', () => {
    expect(toE164('98480 12345')).toBe('+919848012345');
    expect(toE164('+91 98480-12345')).toBe('+919848012345');
    expect(toE164('09848012345')).toBe('+919848012345');
    expect(toE164('12345')).toBeNull();
    expect(toE164('5848012345')).toBeNull(); // Indian mobiles start 6-9
    expect(toE164('+14155550123')).toBe('+14155550123');
  });
});

describe('time helpers', () => {
  it('IST calendar day difference', () => {
    expect(istDayDiff('2026-11-17T10:00:00Z', new Date('2026-11-10T20:00:00Z'))).toBe(6); // 20:00Z is already 11 Nov 01:30 IST
    expect(daysLeftText(7)).toBe('in 7 days');
    expect(daysLeftText(1)).toBe('tomorrow');
    expect(daysLeftText(0)).toBe('today');
    expect(daysLeftText(-3)).toBe('3 days ago');
    expect(fmtMoney(589882)).toBe('₹5,898.82');
  });
});

describe('internal event -> communication events', () => {
  it('payment.paid: new purchase vs renewal vs verified transfer', () => {
    const keys = (d) => commEventsFor('payment.paid', d).map((e) => e.key);
    expect(keys({ invoiced: true })).toEqual(['payment.succeeded', 'invoice.generated']);
    expect(keys({ renewal: true, invoiced: true })).toEqual(['renewal.succeeded', 'invoice.generated']);
    expect(keys({ verified: true, invoiced: true })).toEqual(['payment.offline_verified', 'invoice.generated']);
  });
  it('cancellation depends on who did it; sweep cancels take effect', () => {
    expect(commEventsFor('subscription.cancelled', {}, { self: false }).map((e) => e.key)).toEqual(['cancellation.by_admin', 'access.revoked']);
    expect(commEventsFor('subscription.cancelled', { sweep: true }).map((e) => e.key)).toEqual(['cancellation.effective', 'access.revoked']);
    expect(commEventsFor('subscription.cancelled', { reason: 'plan_changed' })).toEqual([]);
  });
  it('approval replaces the plain activation message; unknown keys send nothing', () => {
    expect(commEventsFor('member.activated', { approved: true })[0].key).toBe('application.approved');
    expect(commEventsFor('plan.created')).toEqual([]);
    expect(commEventsFor('member.added', { welcome: false })).toEqual([]);
  });
});

describe('reminders', () => {
  const now = new Date('2026-11-10T04:30:00Z'); // 10:00 IST
  const sub = (days, o = {}) => ({ id: 's1', status: 'ACTIVE', ends_at: new Date(now.getTime() + days * 86_400_000), ...o });
  it('fires on the configured day only', () => {
    expect(reminderDue(sub(7), { days_before: 7 }, now)).toBe(true);
    expect(reminderDue(sub(7), { days_before: 3 }, now)).toBe(false);
  });
  it('skips cancelling members, auto-renew when asked, and expired members before expiry day', () => {
    expect(reminderDue(sub(7, { cancel_at_period_end: true }), { days_before: 7 }, now)).toBe(false);
    expect(reminderDue(sub(7, { auto_renew: true }), { days_before: 7 }, now, { skipAutoRenew: true })).toBe(false);
    expect(reminderDue(sub(7, { status: 'EXPIRED' }), { days_before: 7 }, now)).toBe(false);
    expect(reminderDue(sub(-7, { status: 'EXPIRED' }), { days_before: -7 }, now)).toBe(true);
  });
  it('event id is stable per member period and step (idempotent)', () => {
    expect(reminderEventId(sub(7), { days_before: 7 })).toBe(reminderEventId(sub(7), { days_before: 7 }));
    expect(reminderEventId(sub(7), { days_before: 7 })).not.toBe(reminderEventId(sub(7), { days_before: 3 }));
    expect(stepChannels({ in_app: true, whatsapp: false, email: true })).toEqual(['IN_APP', 'EMAIL']);
  });
});

describe('who gets which channel', () => {
  const settings = { in_app: { enabled: true }, whatsapp: { enabled: true, opt_in_required: true }, email: { enabled: true }, sms: { enabled: false } };
  const base = { settings, event: { is_mandatory: false }, member: { whatsapp_opt_in: true }, pref: undefined };
  it('WhatsApp needs opt-in even for mandatory events', () => {
    expect(skipReason({ ...base, channel: 'WHATSAPP', member: { whatsapp_opt_in: false }, event: { is_mandatory: true } })).toBe('No WhatsApp opt-in');
    expect(skipReason({ ...base, channel: 'WHATSAPP' })).toBeNull();
  });
  it('member preferences apply to optional events only (mandatory In-App/Email ignore "off")', () => {
    expect(skipReason({ ...base, channel: 'EMAIL', pref: false })).toMatch(/turned this off/);
    expect(skipReason({ ...base, channel: 'EMAIL', pref: false, event: { is_mandatory: true } })).toBeNull();
    expect(skipReason({ ...base, channel: 'WHATSAPP', pref: false, event: { is_mandatory: true } })).toMatch(/WhatsApp off/);
  });
  it('a channel switched off in settings is skipped', () => {
    expect(skipReason({ ...base, channel: 'SMS' })).toMatch(/switched off/);
  });
});
