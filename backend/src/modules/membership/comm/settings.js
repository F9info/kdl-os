import { prisma } from '../../../config/database.js';

export const COMM_DEFAULTS = {
  in_app: { enabled: true, retention_days: 90, show_unread_count: true, toast: true, page_size: 20 },
  whatsapp: { enabled: true, default_country_code: '+91', opt_in_required: true },
  email: { enabled: true, sender_name: '', sender_email: '', reply_to: '', layout: 'branded' },
  sms: { enabled: false, fallback_for_whatsapp: false },
  delivery: { retry_attempts: 3, block_unresolved: true, quiet_hours: { enabled: true, start: '21:00', end: '08:00' } },
  preferences: { members_can_manage: true, marketing_unsubscribe: true },
  languages: { default: 'en', available: ['en', 'te', 'hi'] },
  company: { name: '', support_email: '', website_url: '', logo_url: '' },
  reminders: {
    send_at: '10:00',
    timezone: 'Asia/Kolkata',
    skip_if_renewed: true,
    skip_auto_renew: false,
    steps: [30, 15, 7, 3, 1, 0].map((d) => ({ days_before: d, in_app: true, whatsapp: true, email: true })),
  },
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  return out;
};

const KEY = 'communication';

export async function getCommSettings(db = prisma) {
  const row = await db.membershipSetting.findUnique({ where: { key: KEY } });
  const s = merge(COMM_DEFAULTS, row?.value);
  // Company identity falls back to the environment so a fresh install has working emails.
  s.company.name ||= process.env.COMPANY_NAME || 'Our organisation';
  s.company.support_email ||= process.env.SUPPORT_EMAIL || 'support@example.com';
  s.company.website_url ||= process.env.FRONTEND_URL || '';
  return s;
}

export async function putCommSettings(patch, db = prisma) {
  const row = await db.membershipSetting.findUnique({ where: { key: KEY } });
  const value = merge(merge(COMM_DEFAULTS, row?.value), patch);
  // arrays (reminder steps, languages) replace, they are not merged
  if (patch.reminders?.steps) value.reminders.steps = patch.reminders.steps;
  if (patch.languages?.available) value.languages.available = patch.languages.available;
  await db.membershipSetting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
  return getCommSettings(db);
}
