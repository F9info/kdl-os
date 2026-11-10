import crypto from 'node:crypto';

// Razorpay REST via fetch (no SDK: the dependency list is locked). Amounts are paise already.
const API = 'https://api.razorpay.com/v1';
const auth = (c) => 'Basic ' + Buffer.from(`${c.key_id}:${c.key_secret}`).toString('base64');

async function call(creds, path, { method = 'GET', body } = {}) {
  if (!creds?.key_id || !creds?.key_secret) {
    const e = new Error('Razorpay key_id and key_secret are not saved');
    e.status = 422;
    throw e;
  }
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: auth(creds), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json?.error?.description || `Razorpay error ${res.status}`);
    e.status = res.status >= 500 ? 502 : 422;
    throw e;
  }
  return json;
}

export const hmacHex = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function safeEqualHex(a, b) {
  const x = Buffer.from(String(a ?? ''), 'utf8');
  const y = Buffer.from(String(b ?? ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default {
  key: 'RAZORPAY',
  type: 'GATEWAY',

  async createOrder({ amount, currency = 'INR', receipt, notes }, creds) {
    const o = await call(creds, '/orders', { method: 'POST', body: { amount, currency, receipt, notes } });
    return { order_id: o.id, key_id: creds.key_id, amount: o.amount, currency: o.currency };
  },

  /** Webhook body is signed with the webhook secret: HMAC-SHA256 of the RAW body, hex. */
  verifyWebhook({ rawBody, signature }, secret) {
    if (!secret || !signature || !rawBody) return false;
    return safeEqualHex(hmacHex(rawBody, secret), signature);
  },

  parseWebhook(body) {
    const ev = body?.event;
    const p = body?.payload?.payment?.entity;
    const order = body?.payload?.order?.entity;
    if (ev === 'payment.captured' || ev === 'order.paid')
      return { type: 'payment.paid', order_id: p?.order_id ?? order?.id, payment_id: p?.id, amount: p?.amount ?? order?.amount_paid };
    if (ev === 'payment.failed')
      return { type: 'payment.failed', order_id: p?.order_id, payment_id: p?.id, reason: p?.error_description };
    return null;
  },

  /** Checkout handler returns order_id|payment_id signed with the API key secret. */
  verifyCheckout({ order_id, payment_id, signature }, creds) {
    if (!creds?.key_secret) return false;
    return safeEqualHex(hmacHex(`${order_id}|${payment_id}`, creds.key_secret), signature);
  },

  async refund({ payment_id, amount }, creds) {
    const r = await call(creds, `/payments/${payment_id}/refund`, { method: 'POST', body: amount ? { amount } : {} });
    return { refund_id: r.id };
  },

  async test(creds) {
    try {
      await call(creds, '/payments?count=1');
      return { ok: true, message: 'Razorpay accepted the keys' };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  },
};
