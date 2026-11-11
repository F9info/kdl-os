import { h, actor, v } from '../handlers.js';
import * as admin from './admin.service.js';
import * as mem from './member.service.js';

// ----- admin -----
export const events = h(() => admin.listEvents());
export const eventSwitch = h((req) => admin.setEventChannel(v(req).params.key, v(req).body, actor(req)));
export const eventCreate = h((req) => admin.createCustomEvent(v(req).body, actor(req)), 201);
export const templates = h((req) => admin.listTemplates(v(req).query));
export const templateGet = h((req) => admin.getTemplate(v(req).params.event, v(req).params.channel, v(req).params.lang));
export const templatePut = h((req) => admin.putTemplate(v(req).params.event, v(req).params.channel, v(req).params.lang, v(req).body, actor(req)));
export const templateTest = h((req) => admin.testSend(v(req).params.event, v(req).params.channel, v(req).params.lang, v(req).body, actor(req)));
export const variables = h((req) => admin.variablesFor(v(req).query.event));
export const logs = h((req) => admin.listLogs(v(req).query));
export const logGet = h((req) => admin.getLog(req.params.id));
export const logRetry = h((req) => admin.retry(req.params.id, actor(req)));
export const logsRetryFailed = h((req) => admin.retryAllFailed(actor(req)));
export const logsExport = async (req, res, next) => {
  try {
    const csv = await admin.exportLogs(v(req).query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="communication-logs.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};
export const remindersGet = h(() => admin.getReminders());
export const remindersPut = h((req) => admin.putReminders(v(req).body, actor(req)));
export const settingsGet = h(() => admin.getSettings());
export const settingsPut = h((req) => admin.putSettings(v(req).body, actor(req)));
export const settingsTest = h(async (req) => {
  const { channel } = v(req).params;
  const to = v(req).body?.to;
  const base = await admin.testConnection(channel.toUpperCase());
  if (channel === 'email' && to && base.ok) {
    const { dispatchMessage } = await import('../../integrations/service.js');
    const r = await dispatchMessage({ channel: 'EMAIL', to, subject: 'Test email', body: '<p>This is a test email from your membership communication settings.</p>', source: 'membership.test' });
    return { ...base, sent: true, log_id: r.logId };
  }
  return base;
});
export const settingsSync = h(async () => ({ synced: 0, message: 'The configured WhatsApp driver sends free-form text; template sync is not available for it.' }));

// ----- member -----
export const myNotifications = h((req) => mem.listNotifications(req.member, v(req).query));
export const myUnread = h((req) => mem.unreadCount(req.member));
export const myRead = h((req) => mem.markRead(req.member, v(req).body));
export const myPrefs = h((req) => mem.getPreferences(req.member));
export const myPrefsPut = h((req) => mem.putPreferences(req.member, v(req).body, actor(req)));
export const waOptIn = h((req) => mem.whatsappOptIn(req.member, actor(req)));
export const waOptOut = h((req) => mem.whatsappOptOut(req.member, actor(req)));
