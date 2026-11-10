import { prisma } from '../../config/database.js';

export const DEFAULT_SETTINGS = {
  general: {
    member_no_prefix: 'KDL-M',
    invoice_prefix: 'MEM',
    gst_rate_default: 18,
    grace_days: 7,
    renewal_rules: { auto_renew_default: true, reminder_days: [30, 15, 7, 3, 1] },
    policies: { refund_policy: '', terms_url: '', privacy_url: '' },
  },
  signup: {
    primary_login: 'MOBILE_OTP',
    allow_email_password: true,
    require_approval_default: false,
    member_types: ['INDIVIDUAL', 'ORGANISATION'],
  },
};

const merge = (base, over) => {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], v) : v;
  }
  return out;
};

export async function getSettings(db = prisma) {
  const rows = await db.membershipSetting.findMany({ where: { key: { in: Object.keys(DEFAULT_SETTINGS) } } });
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([k, d]) => [k, merge(d, byKey[k])]));
}

export async function putSettings(patch, db = prisma) {
  const current = await getSettings(db);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!patch[key]) continue;
    const value = merge(current[key], patch[key]);
    await db.membershipSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  return getSettings(db);
}
