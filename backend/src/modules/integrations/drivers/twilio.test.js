import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import driver from './twilio.js';

const CREDS = { accountSid: 'ACtest123', authToken: 'auth_token_abc' };
const CONFIG = { fromNumber: '+12025550100' };

// Recorded fixture — Twilio message create response
const SUCCESS_FIXTURE = {
  sid: 'SM1234567890abcdef1234567890abcdef',
  status: 'queued',
  to: '+919876543210',
  from: '+12025550100',
  body: 'Hello',
};

function mockFetch(body, { ok = true, status = 201 } = {}) {
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

describe('twilio driver — metadata', () => {
  it('has correct channel and driver name', () => {
    expect(driver.channel).toBe('SMS');
    expect(driver.driver).toBe('twilio');
  });

  it('credentialsSchema requires accountSid and authToken', () => {
    expect(() => driver.credentialsSchema.parse(CREDS)).not.toThrow();
    expect(() => driver.credentialsSchema.parse({ accountSid: 'AC123' })).toThrow();
    expect(() => driver.credentialsSchema.parse({ authToken: 'tok' })).toThrow();
  });

  it('configSchema requires fromNumber', () => {
    expect(() => driver.configSchema.parse(CONFIG)).not.toThrow();
    expect(() => driver.configSchema.parse({ fromNumber: '' })).toThrow();
    expect(() => driver.configSchema.parse({})).toThrow();
  });
});

describe('twilio driver — send()', () => {
  it('calls Twilio Messages endpoint for the account', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '+919876543210', body: 'Hello' });
    const [url] = fetch.mock.calls[0];
    expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/ACtest123/Messages.json');
  });

  it('uses HTTP Basic auth with accountSid:authToken', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '+919876543210', body: 'Hello' });
    const [, opts] = fetch.mock.calls[0];
    const expected = `Basic ${Buffer.from('ACtest123:auth_token_abc').toString('base64')}`;
    expect(opts.headers.Authorization).toBe(expected);
  });

  it('sends form-encoded body with From/To/Body', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '+919876543210', body: 'Test message' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    const params = new URLSearchParams(opts.body);
    expect(params.get('From')).toBe('+12025550100');
    expect(params.get('To')).toBe('+919876543210');
    expect(params.get('Body')).toBe('Test message');
  });

  it('returns provider_ref from sid', async () => {
    const result = await driver.send({ credentials: CREDS, config: CONFIG, to: '+919876543210', body: 'Hi' });
    expect(result).toEqual({ provider_ref: 'SM1234567890abcdef1234567890abcdef' });
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({ code: 20003, message: 'Authenticate' }, { ok: false, status: 401 }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '+919876543210', body: 'Hi' }))
      .rejects.toThrow('Twilio error 401');
  });
});

describe('twilio driver — parseWebhook()', () => {
  it('maps delivered → DELIVERED', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'delivered' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'DELIVERED' });
  });

  it('maps sent → SENT', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'sent' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'SENT' });
  });

  it('maps failed → FAILED', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'failed' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'FAILED' });
  });

  it('maps undelivered → FAILED', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'undelivered' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'FAILED' });
  });

  it('maps queued → QUEUED', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'queued' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'QUEUED' });
  });

  it('maps read → READ', () => {
    const req = { body: { MessageSid: 'SM123', MessageStatus: 'read' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'SM123', status: 'READ' });
  });

  it('returns null when MessageSid missing', () => {
    expect(driver.parseWebhook({ body: { MessageStatus: 'delivered' } })).toBeNull();
  });

  it('returns null for unknown status', () => {
    expect(driver.parseWebhook({ body: { MessageSid: 'SM123', MessageStatus: 'unknown_status' } })).toBeNull();
  });

  it('returns null for empty body', () => {
    expect(driver.parseWebhook({ body: {} })).toBeNull();
  });
});
