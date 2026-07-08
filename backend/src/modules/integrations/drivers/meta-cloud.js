import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const META_STATUS = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

const credentialsSchema = z.object({
  accessToken: z.string().min(1),
  appSecret: z.string().min(1),
});

const configSchema = z.object({
  wabaNumber: z.string().min(1),
  phoneNumberId: z.string().min(1),
  verifyToken: z.string().min(1).optional(),
});

export default {
  channel: 'WHATSAPP',
  driver: 'meta-cloud',
  credentialsSchema,
  configSchema,

  async send({ credentials, config, to, body }) {
    const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Meta Cloud API error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const msgId = data.messages?.[0]?.id ?? null;
    return { provider_ref: msgId };
  },

  verifySignature(req, credentials) {
    const sig = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody;
    if (!sig || !rawBody) return false;
    try {
      const expected = `sha256=${createHmac('sha256', credentials.appSecret).update(rawBody).digest('hex')}`;
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  verifyGetChallenge(req, _credentials, config) {
    const mode = req.query?.['hub.mode'];
    const token = req.query?.['hub.verify_token'];
    const challenge = req.query?.['hub.challenge'];
    if (mode !== 'subscribe' || !challenge) return null;
    if (!config?.verifyToken || token !== config.verifyToken) return null;
    return challenge;
  },

  parseWebhook(req) {
    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const statusEntry = change?.value?.statuses?.[0];
      if (!statusEntry) return null;

      const rawStatus = (statusEntry.status ?? '').toLowerCase();
      const status = META_STATUS[rawStatus] ?? null;
      const provider_ref = statusEntry.id ?? null;

      if (!provider_ref || !status) return null;
      return { provider_ref, status };
    } catch {
      return null;
    }
  },
};
