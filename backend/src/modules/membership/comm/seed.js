import { prisma } from '../../../config/database.js';
import { CATALOG, defaultTemplates } from './events.js';

// security.new_login would mail every sign-in: keep it in-app only until an admin opts in.
const CHANNEL_OVERRIDES = { 'security.new_login': { WHATSAPP: false, EMAIL: false } };

let done = false;

/** Idempotent: adds missing events and English templates, never overwrites what an admin changed. */
export async function ensureCommSeed(db = prisma, { force = false } = {}) {
  if (done && !force) return;
  for (const { pref_category: _p, key, ...e } of CATALOG) {
    await db.membershipCommEvent.upsert({
      where: { key },
      create: { key, ...e, channels: { ...e.channels, ...CHANNEL_OVERRIDES[key] } },
      update: {},
    });
    for (const t of defaultTemplates(key)) {
      await db.membershipCommTemplate.upsert({
        where: { event_key_channel_lang: { event_key: t.event_key, channel: t.channel, lang: t.lang } },
        create: t,
        update: {},
      });
    }
  }
  done = true;
}
