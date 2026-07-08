import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import driver from './msg91.js';

const CREDS = { authKey: 'test-auth-key-123' };
const CONFIG = { senderId: 'KDLAPP' };

// Recorded fixture — what MSG91 returns on success
const SUCCESS_FIXTURE = {
  message: '12345',
  type: 'success',
  request_id: 'req_abc123xyz',
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

describe('msg91 driver — metadata', () => {
  it('has correct channel and driver name', () => {
    expect(driver.channel).toBe('SMS');
    expect(driver.driver).toBe('msg91');
  });

  it('credentialsSchema requires authKey', () => {
    expect(() => driver.credentialsSchema.parse(CREDS)).not.toThrow();
    expect(() => driver.credentialsSchema.parse({})).toThrow();
    expect(() => driver.credentialsSchema.parse({ authKey: '' })).toThrow();
  });

  it('configSchema requires senderId', () => {
    expect(() => driver.configSchema.parse(CONFIG)).not.toThrow();
    expect(() => driver.configSchema.parse({ senderId: '' })).toThrow();
  });
});

describe('msg91 driver — send()', () => {
  it('calls correct MSG91 endpoint', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    expect(fetch).toHaveBeenCalledWith(
      'https://api.msg91.com/api/v5/flow/',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('sends authkey header', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [, opts] = fetch.mock.calls[0];
    expect(opts.headers).toMatchObject({ authkey: 'test-auth-key-123' });
  });

  it('sends correct JSON body', async () => {
    await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    const [, opts] = fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ sender: 'KDLAPP', mobiles: '919876543210', message: 'Hello' });
  });

  it('returns provider_ref from request_id', async () => {
    const result = await driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'Hello' });
    expect(result).toEqual({ provider_ref: 'req_abc123xyz' });
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch('Bad Request', { ok: false, status: 400 }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'msg' }))
      .rejects.toThrow('MSG91 error 400');
  });

  it('throws when response type is not success', async () => {
    vi.stubGlobal('fetch', mockFetch({ type: 'error', message: 'Invalid auth key' }));
    await expect(driver.send({ credentials: CREDS, config: CONFIG, to: '919876543210', body: 'msg' }))
      .rejects.toThrow('MSG91 rejected');
  });
});

describe('msg91 driver — parseWebhook()', () => {
  it('maps status 3 → DELIVERED', () => {
    const req = { query: { requestId: 'req_abc', status: '3' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'req_abc', status: 'DELIVERED' });
  });

  it('maps status 1 → SENT', () => {
    const req = { query: { requestId: 'req_abc', status: '1' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'req_abc', status: 'SENT' });
  });

  it('maps status 9 → FAILED', () => {
    const req = { query: { requestId: 'req_abc', status: '9' } };
    expect(driver.parseWebhook(req)).toEqual({ provider_ref: 'req_abc', status: 'FAILED' });
  });

  it('returns null when requestId missing', () => {
    expect(driver.parseWebhook({ query: { status: '3' } })).toBeNull();
  });

  it('returns null when status unknown', () => {
    expect(driver.parseWebhook({ query: { requestId: 'req_abc', status: '99' } })).toBeNull();
  });

  it('returns null for empty query', () => {
    expect(driver.parseWebhook({ query: {} })).toBeNull();
  });
});
