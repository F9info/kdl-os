import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import driver from './gupshup.js';

const CREDS = { apiKey: 'gupshup-api-key-test' };
const CONFIG = { appName: 'KDLApp', srcName: '919000000001' };

// Recorded fixture — Gupshup submit response
const SUCCESS_FIXTURE = {
  status: 'submitted',
  messageId: 'gup_msg_abc123',
};

// Recorded fixture — Gupshup delivery webhook
const WEBHOOK_DELIVERED = {
  app: 'KDLApp',
  timestamp: 1689123456789,
  version: 2,
  type: 'message-event',
  payload: {
    id: 'gup_msg_abc123',
    type: 'DELIVERED',
    destination: '919876543210',
    'GSId': 'some-gs-id',
  },
};

function mockFetch(body, { ok = true, status = 202 } = {}) {
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

describe('gupshup driver — metadata', () => {
  it('has correct channel and driver name', () => {
    expect(driver.channel).toBe('WHATSAPP');
    expect(driver.driver).toBe('gupshup');
  });

  it('credentialsSchema requires apiKey', () => {
    expect(() => driver.credentialsSchema.parse(CREDS)).not.toThrow();
    expect(() => driver.credentialsSchema.parse({ apiKey: '' })).toThrow();
    expect(() => driver.credentialsSchema.parse({})).toThrow();
  });

  it('configSchema requires appName and srcName', () => {
    expect(() => driver.configSchema.parse(CONFIG)).not.toThrow();
    expect(() => driver.configSchema.parse({ appName: 'App' })).toThrow();
    expect(() => driver.configSchema.parse({ srcName: '9190000001' })).toThrow();
  });
});

describe('gupshup driver — send()', () => {
  it('calls correct Gupshup endpoint', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [url] = fetch.mock.calls[0];
    expect(url).toBe('https://api.gupshup.io/sm/api/v1/msg');
  });

  it('sends apikey header', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers.apikey).toBe('gupshup-api-key-test');
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
  });

  it('sends form-encoded body with correct fields', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi there' });
    const [, opts] = fetch.mock.calls[0];
    const params = new URLSearchParams(opts.body);
    expect(params.get('channel')).toBe('whatsapp');
    expect(params.get('source')).toBe('919000000001');
    expect(params.get('destination')).toBe('919876543210');
    expect(params.get('src.name')).toBe('KDLApp');
    const message = JSON.parse(params.get('message'));
    expect(message).toEqual({ type: 'text', text: 'Hi there' });
  });

  it('returns provider_ref from messageId', async () => {
    const result = await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi' });
    expect(result).toEqual({ provider_ref: 'gup_msg_abc123' });
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch('Unauthorized', { ok: false, status: 401 }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi' }))
      .rejects.toThrow('Gupshup error 401');
  });

  it('throws when response status is not submitted', async () => {
    vi.stubGlobal('fetch', mockFetch({ status: 'error', message: 'Invalid API key' }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hi' }))
      .rejects.toThrow('Gupshup rejected');
  });
});

describe('gupshup driver — parseWebhook()', () => {
  it('maps DELIVERED → DELIVERED', () => {
    const req = { body: WEBHOOK_DELIVERED };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_msg_abc123', status: 'DELIVERED' });
  });

  it('maps SENT → SENT', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'SENT' } },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_123', status: 'SENT' });
  });

  it('maps READ → READ', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'READ' } },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_123', status: 'READ' });
  });

  it('maps FAILED → FAILED', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'FAILED' } },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_123', status: 'FAILED' });
  });

  it('maps FAILED-DELETE → FAILED', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'FAILED-DELETE' } },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_123', status: 'FAILED' });
  });

  it('maps ENQUEUED → QUEUED', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'ENQUEUED' } },
    };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'gup_123', status: 'QUEUED' });
  });

  it('returns null for non-message-event type', () => {
    const req = {
      body: { type: 'message', payload: { id: 'gup_123', type: 'DELIVERED' } },
    };
    expect(driver.parseWebhook(req)).toBeNull();
  });

  it('returns null when payload missing', () => {
    expect(driver.parseWebhook({ body: { type: 'message-event' } })).toBeNull();
  });

  it('returns null for unknown status', () => {
    const req = {
      body: { type: 'message-event', payload: { id: 'gup_123', type: 'UNKNOWN' } },
    };
    expect(driver.parseWebhook(req)).toBeNull();
  });

  it('returns null for empty body', () => {
    expect(driver.parseWebhook({ body: {} })).toBeNull();
    expect(driver.parseWebhook({})).toBeNull();
  });
});
