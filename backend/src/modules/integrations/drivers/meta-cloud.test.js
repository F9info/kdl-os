import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import driver from './meta-cloud.js';

const CREDS = { accessToken: 'EAAtest_access_token', appSecret: 'test-app-secret' };
const CONFIG = { wabaNumber: '1234567890', phoneNumberId: '109876543210' };

// Recorded fixture — Meta Cloud API response
const SUCCESS_FIXTURE = {
  messaging_product: 'whatsapp',
  contacts: [{ input: '919876543210', wa_id: '919876543210' }],
  messages: [{ id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSQjU2RjhBNkUwRUY4MzZGRjkA' }],
};

// Recorded fixture — Meta delivery webhook payload
const WEBHOOK_DELIVERED = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '123456789',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '1234567890', phone_number_id: '109876543210' },
        statuses: [{
          id: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSQjU2RjhBNkUwRUY4MzZGRjkA',
          status: 'delivered',
          timestamp: '1689123456',
          recipient_id: '919876543210',
        }],
      },
      field: 'messages',
    }],
  }],
};

function mockFetch(body, { ok = true, status = 200 } = {}) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch(SUCCESS_FIXTURE));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('meta-cloud driver — metadata', () => {
  it('has correct channel and driver name', () => {
    expect(driver.channel).toBe('WHATSAPP');
    expect(driver.driver).toBe('meta-cloud');
  });

  it('credentialsSchema requires accessToken', () => {
    expect(() => driver.credentialsSchema.parse(CREDS)).not.toThrow();
    expect(() => driver.credentialsSchema.parse({ accessToken: '' })).toThrow();
    expect(() => driver.credentialsSchema.parse({})).toThrow();
  });

  it('configSchema requires wabaNumber and phoneNumberId', () => {
    expect(() => driver.configSchema.parse(CONFIG)).not.toThrow();
    expect(() => driver.configSchema.parse({ wabaNumber: '123' })).toThrow();
    expect(() => driver.configSchema.parse({ phoneNumberId: '456' })).toThrow();
  });
});

describe('meta-cloud driver — send()', () => {
  it('calls correct Graph API endpoint with phoneNumberId', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [url] = fetch.mock.calls[0];
    expect(url).toBe('https://graph.facebook.com/v19.0/109876543210/messages');
  });

  it('sends Bearer token in Authorization header', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.Authorization).toBe('Bearer EAAtest_access_token');
  });

  it('sends correct JSON body', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello WhatsApp' });
    const [, opts] = fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      messaging_product: 'whatsapp',
      to: '919876543210',
      type: 'text',
      text: { body: 'Hello WhatsApp' },
    });
  });

  it('returns provider_ref from message id', async () => {
    const result = await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi' });
    expect(result).toEqual({
      provider_ref: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSQjU2RjhBNkUwRUY4MzZGRjkA',
    });
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({ error: { message: 'Invalid OAuth', code: 190 } }, { ok: false, status: 401 }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi' }))
      .rejects.toThrow('Meta Cloud API error 401');
  });
});

describe('meta-cloud driver — parseWebhook()', () => {
  it('maps delivered → DELIVERED', () => {
    const req = { body: WEBHOOK_DELIVERED };
    expect(driver.parseWebhook(req)).toEqual({
      provider_ref: 'wamid.HBgNOTE5ODc2NTQzMjEwFQIAERgSQjU2RjhBNkUwRUY4MzZGRjkA',
      status: 'DELIVERED',
    });
  });

  it('maps sent → SENT', () => {
    const req = {
      body: {
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'sent' }] } }] }],
      },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'wamid.123', status: 'SENT' });
  });

  it('maps read → READ', () => {
    const req = {
      body: {
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'read' }] } }] }],
      },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'wamid.123', status: 'READ' });
  });

  it('maps failed → FAILED', () => {
    const req = {
      body: {
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'failed' }] } }] }],
      },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'wamid.123', status: 'FAILED' });
  });

  it('returns null when no statuses array', () => {
    const req = {
      body: {
        entry: [{ changes: [{ value: { messages: [{ id: 'wamid.123' }] } }] }],
      },
    };
    expect(driver.parseWebhook(req)).toBeNull();
  });

  it('returns null for empty body', () => {
    expect(driver.parseWebhook({ body: {} })).toBeNull();
    expect(driver.parseWebhook({})).toBeNull();
  });

  it('returns null for unknown status', () => {
    const req = {
      body: {
        entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.123', status: 'unknown' }] } }] }],
      },
    };
    expect(driver.parseWebhook(req)).toBeNull();
  });
});
