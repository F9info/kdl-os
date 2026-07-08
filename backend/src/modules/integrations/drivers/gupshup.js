import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const GUPSHUP_STATUS = {
  ENQUEUED: 'QUEUED',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  READ: 'READ',
  FAILED: 'FAILED',
  'FAILED-DELETE': 'FAILED',
};

const credentialsSchema = z.object({
  apiKey: z.string().min(1),
  webhookToken: z.string().min(1).optional(),
});

const configSchema = z.object({
  appName: z.string().min(1),
  srcName: z.string().min(1),
});

export default {
  channel: 'WHATSAPP',
  driver: 'gupshup',
  credentialsSchema,
  configSchema,

  async send({ credentials, config, to, body }) {
    const params = new URLSearchParams({
      channel: 'whatsapp',
      source: config.srcName,
      destination: to,
      message: JSON.stringify({ type: 'text', text: body }),
      'src.name': config.appName,
    });

    const resp = await fetch('https://api.gupshup.io/sm/api/v1/msg', {
      method: 'POST',
      headers: {
        apikey: credentials.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gupshup error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    if (data.status !== 'submitted') {
      throw new Error(`Gupshup rejected: ${data.message ?? JSON.stringify(data)}`);
    }

    return { provider_ref: data.messageId ?? null };
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
    try {
      const { type, payload } = req.body ?? {};
      if (type !== 'message-event' || !payload) return null;

      const rawStatus = (payload.type ?? '').toUpperCase();
      const status = GUPSHUP_STATUS[rawStatus] ?? null;
      const provider_ref = payload.id ?? null;

      if (!provider_ref || !status) return null;
      return { provider_ref, status };
    } catch {
      return null;
    }
  },
};
