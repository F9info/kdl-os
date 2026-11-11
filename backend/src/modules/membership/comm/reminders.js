import { prisma } from '../../../config/database.js';
import { logger } from '../../../shared/utils/logger.js';
import { runExpirySweep } from '../core.js';
import { daysLeftText, istDayDiff } from './render.js';
import { emitMembershipEvent } from './dispatch.js';
import { getCommSettings } from './settings.js';

const LIVE = ['ACTIVE', 'TRIALING'];
const AFTER = ['ACTIVE', 'PAST_DUE', 'EXPIRED'];

/** Does `step` fire for this subscription today (IST calendar days)? Pure. */
export function reminderDue(sub, step, now = new Date(), { skipAutoRenew = false } = {}) {
  if (!sub.ends_at || sub.cancel_at_period_end) return false;
  if (skipAutoRenew && sub.auto_renew) return false;
  const left = istDayDiff(sub.ends_at, now);
  if (left !== step.days_before) return false;
  return (step.days_before > 0 ? LIVE : AFTER).includes(sub.status);
}

export const reminderEventId = (sub, step) => `renewal.reminder:${sub.id}:${new Date(sub.ends_at).toISOString().slice(0, 10)}:${step.days_before}`;

export const stepChannels = (step) => ['IN_APP', 'WHATSAPP', 'EMAIL'].filter((c) => step[c.toLowerCase()] !== false);

/** Daily job: lifecycle sweep first (so today's expiries are settled), then reminders. Safe to re-run: ids are per member, period and step. */
export async function runDailyReminders({ now = new Date() } = {}) {
  const sweep = await runExpirySweep({ now });
  const settings = await getCommSettings();
  const { steps, skip_auto_renew } = settings.reminders;
  const subs = await prisma.membershipSubscription.findMany({
    where: { status: { in: AFTER.concat('TRIALING') }, ends_at: { gte: new Date(now.getTime() - 40 * 86_400_000), lte: new Date(now.getTime() + 40 * 86_400_000) } },
  });
  let sent = 0;
  for (const sub of subs) {
    for (const step of steps) {
      if (!reminderDue(sub, step, now, { skipAutoRenew: skip_auto_renew })) continue;
      const channels = stepChannels(step);
      if (!channels.length) continue;
      const id = await emitMembershipEvent('renewal.reminder', sub.member_id, { subscription_id: sub.id, vars: { days_left: daysLeftText(step.days_before) } }, reminderEventId(sub, step), { channels });
      if (id) sent += 1;
    }
  }
  logger.info(`membership daily job: sweep ${JSON.stringify(sweep)}, reminders queued ${sent}`);
  return { sweep, reminders: sent };
}

/** (Re)register the daily repeatable job at settings.reminders.send_at in the configured zone. */
export async function scheduleReminders(queue) {
  const { reminders } = await getCommSettings();
  const [h, m] = String(reminders.send_at).split(':').map(Number);
  for (const r of await queue.getRepeatableJobs()) if (r.name === 'daily') await queue.removeRepeatableByKey(r.key);
  await queue.add('daily', {}, { repeat: { pattern: `${m || 0} ${h ?? 10} * * *`, tz: reminders.timezone || 'Asia/Kolkata' }, removeOnComplete: { count: 10 }, attempts: 2 });
}
