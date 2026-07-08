import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';

const TWILIO_STATUS = {
  queued: 'QUEUED',
  sending: 'QUEUED',
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  undelivered: 'FAILED',
  failed: 'FAILED',
};

const credentialsSchema = z.object({
  accountSid: z.string().min(1),
  authToken: z.string().min(1),
});

const configSchema = z.object({
  fromNumber: z.string().min(1),
});

export default {
  channel: 'SMS',
  driver: 'twilio',
  credentialsSchema,
  configSchema,

  async send({ credentials, config, to, body }) {
    const { accountSid, authToken } = credentials;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const params = new URLSearchParams({ From: config.fromNumber, To: to, Body: body });

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Twilio error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    return { provider_ref: data.sid };
  },

  verifySignature(req, credentials) {
    const sig = req.headers['x-twilio-signature'];
    if (!sig || !credentials?.authToken) return false;
    try {
      // Build the signed string: full URL + sorted params concatenated
      const proto = req.headers['x-forwarded-proto'] ?? req.protocol ?? 'https';
      const host = req.headers.host ?? '';
      const fullUrl = `${proto}://${host}${req.originalUrl}`;
      const body = req.body ?? {};
      const sorted = Object.keys(body).sort();
      const paramStr = sorted.map((k) => `${k}${body[k]}`).join('');
      const signed = `${fullUrl}${paramStr}`;
      const expected = createHmac('sha1', credentials.authToken).update(signed).digest('base64');
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },

  parseWebhook(req) {
    const b = req.body ?? {};
    const sid = b.MessageSid ?? null;
    const rawStatus = (b.MessageStatus ?? '').toLowerCase();
    const status = TWILIO_STATUS[rawStatus] ?? null;

    if (!sid || !status) return null;
    return { provider_ref: sid, status };
  },
};
