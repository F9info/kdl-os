import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const BASE_URL = 'https://api.msg91.com/api/v5';

const MSG91_STATUS = {
  '1': 'SENT',
  '2': 'FAILED',
  '3': 'DELIVERED',
  '9': 'FAILED',
  '13': 'FAILED',
};

const credentialsSchema = z.object({
  authKey: z.string().min(1),
  webhookToken: z.string().min(1).optional(),
});

const configSchema = z.object({
  senderId: z.string().min(1).max(6),
});

export default {
  channel: 'SMS',
  driver: 'msg91',
  credentialsSchema,
  configSchema,

  async send({ credentials, config, to, body }) {
    const resp = await fetch(`${BASE_URL}/flow/`, {
      method: 'POST',
      headers: {
        authkey: credentials.authKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: config.senderId,
        short_url: '0',
        mobiles: to,
        message: body,
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`MSG91 error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    if (data.type !== 'success') {
      throw new Error(`MSG91 rejected: ${data.message ?? JSON.stringify(data)}`);
    }

    return { provider_ref: data.request_id ?? null };
  },

  verifySignature(req, credentials, _config) {
    const secret = credentials?.webhookToken;
    if (!secret) return false;
    const token = req.query?.token ?? req.headers['x-webhook-token'] ?? '';
    try {
      const a = Buffer.from(token);
      const b = Buffer.from(secret);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseWebhook(req) {
    const q = req.query ?? {};
    const requestId = q.requestId ?? q.msgId ?? null;
    const rawStatus = String(q.status ?? '');
    const status = MSG91_STATUS[rawStatus] ?? null;

    if (!requestId || !status) return null;
    return { provider_ref: requestId, status };
  },
};
