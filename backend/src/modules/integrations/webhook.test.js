import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('../../config/database.js', () => ({
  prisma: {
    integrationLog: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
    integrationProvider: { findMany: vi.fn() },
  },
}));

vi.mock('./drivers/index.js', () => ({
  getDriver: vi.fn(),
}));

vi.mock('./shared/crypto.js', () => ({
  encrypt: vi.fn((v) => `enc:${v}`),
  decrypt: vi.fn((v) => v.replace(/^enc:/, '')),
}));

vi.mock('../../config/redis.js', () => ({
  redis: { incr: vi.fn().mockResolvedValue(1), expire: vi.fn().mockResolvedValue(1) },
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({ on: vi.fn(), close: vi.fn() })),
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    getWaitingCount: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock('../../shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

vi.mock('../../middleware/module-gate.js', () => ({
  getModuleStatus: vi.fn(),
}));

vi.mock('../../shared/utils/pagination.js', () => ({
  getPaginationParams: vi.fn(() => ({ page: 1, limit: 20, skip: 0 })),
}));

const { prisma } = await import('../../config/database.js');
const { getDriver } = await import('./drivers/index.js');
const { decrypt } = await import('./shared/crypto.js');
const { webhookGetHandler, webhookHandler, getLogs } = await import('./controller.js');

afterEach(() => {
  vi.clearAllMocks();
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeReqRes({ params = {}, body = {}, query = {}, headers = {}, rawBody = null } = {}) {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.end = vi.fn().mockReturnValue(res);
  return {
    req: { params, body, query, headers, ip: '127.0.0.1', rawBody },
    res,
    next: vi.fn(),
  };
}

// ─── webhookHandler — unknown driver ─────────────────────────────────────────

describe('webhookHandler — unknown driver', () => {
  it('returns 404 for unregistered driver', async () => {
    getDriver.mockImplementation(() => { throw new Error('unknown'); });
    const { req, res, next } = makeReqRes({ params: { driver: 'fakedriver' } });
    await webhookHandler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── webhookHandler — signature rejection 401 ────────────────────────────────

describe('webhookHandler — meta-cloud signature rejection', () => {
  const mockDriver = {
    verifySignature: vi.fn().mockReturnValue(false),
    parseWebhook: vi.fn(),
  };

  beforeEach(() => {
    getDriver.mockReturnValue(mockDriver);
    prisma.integrationProvider.findMany.mockResolvedValue([{
      id: 'prov-1',
      credentials: 'enc:{"accessToken":"tok","appSecret":"secret"}',
      config: { wabaNumber: '1234', phoneNumberId: '5678' },
    }]);
    decrypt.mockReturnValue('{"accessToken":"tok","appSecret":"secret"}');
  });

  it('returns 401 when verifySignature returns false', async () => {
    const { req, res, next } = makeReqRes({
      params: { driver: 'meta-cloud' },
      headers: { 'x-hub-signature-256': 'sha256=badsig' },
      rawBody: Buffer.from('{}'),
    });
    await webhookHandler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockDriver.parseWebhook).not.toHaveBeenCalled();
  });

  it('returns 401 when no provider found (no credentials to verify)', async () => {
    prisma.integrationProvider.findMany.mockResolvedValue([]);
    const { req, res, next } = makeReqRes({
      params: { driver: 'meta-cloud' },
    });
    await webhookHandler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('webhookHandler — twilio signature rejection', () => {
  const mockDriver = {
    verifySignature: vi.fn().mockReturnValue(false),
    parseWebhook: vi.fn(),
  };

  beforeEach(() => {
    getDriver.mockReturnValue(mockDriver);
    prisma.integrationProvider.findMany.mockResolvedValue([{
      id: 'prov-2',
      credentials: 'enc:{"accountSid":"ACxxx","authToken":"tok123"}',
      config: { fromNumber: '+1234567890' },
    }]);
    decrypt.mockReturnValue('{"accountSid":"ACxxx","authToken":"tok123"}');
  });

  it('returns 401 when Twilio signature is wrong', async () => {
    const { req, res, next } = makeReqRes({
      params: { driver: 'twilio' },
      headers: { 'x-twilio-signature': 'bad', host: 'example.com' },
      body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
    });
    await webhookHandler(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

// ─── webhookHandler — valid signature processes correctly ─────────────────────

describe('webhookHandler — valid signature + status transition', () => {
  const mockDriver = {
    verifySignature: vi.fn().mockReturnValue(true),
    parseWebhook: vi.fn().mockReturnValue({ provider_ref: 'SM123', status: 'DELIVERED' }),
  };

  beforeEach(() => {
    getDriver.mockReturnValue(mockDriver);
    prisma.integrationProvider.findMany.mockResolvedValue([{
      id: 'prov-2',
      credentials: 'enc:{"accountSid":"ACxxx","authToken":"tok123"}',
      config: { fromNumber: '+1234567890' },
    }]);
    decrypt.mockReturnValue('{"accountSid":"ACxxx","authToken":"tok123"}');
    prisma.integrationLog.findFirst.mockResolvedValue({ id: 'log-1', status: 'SENT' });
    prisma.integrationLog.update.mockResolvedValue({});
  });

  it('updates log status on valid signature', async () => {
    const { req, res, next } = makeReqRes({
      params: { driver: 'twilio' },
      body: { MessageSid: 'SM123', MessageStatus: 'delivered' },
    });
    await webhookHandler(req, res, next);
    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'log-1' },
        data: expect.objectContaining({ status: 'DELIVERED' }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('sets delivered_at on DELIVERED status', async () => {
    mockDriver.parseWebhook.mockReturnValue({ provider_ref: 'SM123', status: 'DELIVERED' });
    const { req, res, next } = makeReqRes({ params: { driver: 'twilio' } });
    await webhookHandler(req, res, next);
    const call = prisma.integrationLog.update.mock.calls[0];
    expect(call[0].data.delivered_at).toBeInstanceOf(Date);
  });

  it('sets delivered_at on READ status', async () => {
    mockDriver.parseWebhook.mockReturnValue({ provider_ref: 'SM123', status: 'READ' });
    const { req, res, next } = makeReqRes({ params: { driver: 'meta-cloud' } });
    await webhookHandler(req, res, next);
    const call = prisma.integrationLog.update.mock.calls[0];
    expect(call[0].data.delivered_at).toBeInstanceOf(Date);
  });

  it('returns 200 and does not update when no matching log', async () => {
    prisma.integrationLog.findFirst.mockResolvedValue(null);
    const { req, res, next } = makeReqRes({ params: { driver: 'twilio' } });
    await webhookHandler(req, res, next);
    expect(prisma.integrationLog.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 when parseWebhook returns null', async () => {
    mockDriver.parseWebhook.mockReturnValue(null);
    const { req, res, next } = makeReqRes({ params: { driver: 'twilio' } });
    await webhookHandler(req, res, next);
    expect(prisma.integrationLog.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

// ─── status transition matrix ─────────────────────────────────────────────────

describe('webhookHandler — status transitions QUEUED→SENT→DELIVERED→READ→FAILED', () => {
  const transitions = [
    { from: 'QUEUED', to: 'SENT' },
    { from: 'SENT', to: 'DELIVERED' },
    { from: 'DELIVERED', to: 'READ' },
    { from: 'SENT', to: 'FAILED' },
  ];

  for (const { from, to } of transitions) {
    it(`transitions ${from} → ${to}`, async () => {
      const mockDriver = {
        verifySignature: vi.fn().mockReturnValue(true),
        parseWebhook: vi.fn().mockReturnValue({ provider_ref: 'ref-x', status: to }),
      };
      getDriver.mockReturnValue(mockDriver);
      prisma.integrationProvider.findMany.mockResolvedValue([{
        id: 'prov-t',
        credentials: 'enc:{}',
        config: {},
      }]);
      decrypt.mockReturnValue('{}');
      prisma.integrationLog.findFirst.mockResolvedValue({ id: 'log-t', status: from });
      prisma.integrationLog.update.mockResolvedValue({});

      const { req, res, next } = makeReqRes({ params: { driver: 'twilio' } });
      await webhookHandler(req, res, next);

      expect(prisma.integrationLog.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: to }) }),
      );
    });
  }
});

// ─── meta-cloud verifySignature unit test ─────────────────────────────────────

describe('meta-cloud driver verifySignature', () => {
  it('accepts correct X-Hub-Signature-256', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const appSecret = 'my-app-secret';
    const payload = Buffer.from(JSON.stringify({ entry: [] }));
    const expected = `sha256=${createHmac('sha256', appSecret).update(payload).digest('hex')}`;
    const req = {
      headers: { 'x-hub-signature-256': expected },
      rawBody: payload,
    };
    expect(metaCloud.verifySignature(req, { accessToken: 't', appSecret })).toBe(true);
  });

  it('rejects bad signature', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const req = {
      headers: { 'x-hub-signature-256': 'sha256=badbadbad' },
      rawBody: Buffer.from('{}'),
    };
    expect(metaCloud.verifySignature(req, { accessToken: 't', appSecret: 'secret' })).toBe(false);
  });

  it('rejects missing header', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const req = { headers: {}, rawBody: Buffer.from('{}') };
    expect(metaCloud.verifySignature(req, { accessToken: 't', appSecret: 'secret' })).toBe(false);
  });
});

// ─── twilio verifySignature unit test ─────────────────────────────────────────

describe('twilio driver verifySignature', () => {
  it('accepts correct X-Twilio-Signature', async () => {
    const { default: twilio } = await import('./drivers/twilio.js');
    const authToken = 'twilio-auth-token';
    const body = { AccountSid: 'ACxxx', MessageSid: 'SM1', MessageStatus: 'delivered' };
    const url = 'https://example.com/api/integrations/webhooks/twilio';
    const sorted = Object.keys(body).sort();
    const paramStr = sorted.map((k) => `${k}${body[k]}`).join('');
    const signed = `${url}${paramStr}`;
    const sig = createHmac('sha1', authToken).update(signed).digest('base64');

    const req = {
      headers: {
        'x-twilio-signature': sig,
        'x-forwarded-proto': 'https',
        host: 'example.com',
      },
      originalUrl: '/api/integrations/webhooks/twilio',
      body,
    };
    expect(twilio.verifySignature(req, { accountSid: 'ACxxx', authToken })).toBe(true);
  });

  it('rejects wrong signature', async () => {
    const { default: twilio } = await import('./drivers/twilio.js');
    const req = {
      headers: {
        'x-twilio-signature': 'wrongsig',
        'x-forwarded-proto': 'https',
        host: 'example.com',
      },
      originalUrl: '/api/integrations/webhooks/twilio',
      body: { MessageSid: 'SM1' },
    };
    expect(twilio.verifySignature(req, { accountSid: 'ACxxx', authToken: 'tok' })).toBe(false);
  });
});

// ─── msg91 verifySignature unit test ──────────────────────────────────────────

describe('msg91 driver verifySignature', () => {
  it('accepts matching webhookToken in query', async () => {
    const { default: msg91 } = await import('./drivers/msg91.js');
    const secret = 'my-webhook-secret';
    const req = { query: { token: secret }, headers: {} };
    expect(msg91.verifySignature(req, { authKey: 'k', webhookToken: secret }, { senderId: 'SENDER' })).toBe(true);
  });

  it('rejects wrong token', async () => {
    const { default: msg91 } = await import('./drivers/msg91.js');
    const req = { query: { token: 'wrong' }, headers: {} };
    expect(msg91.verifySignature(req, { authKey: 'k', webhookToken: 'correct' }, { senderId: 'SENDER' })).toBe(false);
  });

  it('rejects when no webhookToken configured', async () => {
    const { default: msg91 } = await import('./drivers/msg91.js');
    const req = { query: {}, headers: {} };
    expect(msg91.verifySignature(req, { authKey: 'k' }, { senderId: 'SENDER' })).toBe(false);
  });
});

// ─── meta-cloud GET challenge ─────────────────────────────────────────────────

describe('webhookGetHandler — meta-cloud GET challenge', () => {
  it('echoes hub.challenge when verify_token matches', async () => {
    const mockDriver = {
      verifyGetChallenge: vi.fn().mockReturnValue('challenge-abc'),
    };
    getDriver.mockReturnValue(mockDriver);
    prisma.integrationProvider.findMany.mockResolvedValue([{
      config: { wabaNumber: '1234', phoneNumberId: '5678', verifyToken: 'mytoken' },
    }]);

    const { req, res, next } = makeReqRes({
      params: { driver: 'meta-cloud' },
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'mytoken', 'hub.challenge': 'challenge-abc' },
    });
    res.send = vi.fn().mockReturnValue(res);

    await webhookGetHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('challenge-abc');
  });

  it('returns 403 when verify_token does not match', async () => {
    const mockDriver = {
      verifyGetChallenge: vi.fn().mockReturnValue(null),
    };
    getDriver.mockReturnValue(mockDriver);
    prisma.integrationProvider.findMany.mockResolvedValue([{
      config: { verifyToken: 'correct' },
    }]);

    const { req, res, next } = makeReqRes({
      params: { driver: 'meta-cloud' },
      query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'ch' },
    });

    await webhookGetHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 405 for driver without verifyGetChallenge', async () => {
    getDriver.mockReturnValue({ verifySignature: vi.fn(), parseWebhook: vi.fn() });

    const { req, res, next } = makeReqRes({ params: { driver: 'twilio' } });

    await webhookGetHandler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(405);
  });
});

// ─── meta-cloud verifyGetChallenge unit test ──────────────────────────────────

describe('meta-cloud driver verifyGetChallenge', () => {
  it('returns challenge when mode=subscribe and token matches', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'secret', 'hub.challenge': 'ch123' } };
    expect(metaCloud.verifyGetChallenge(req, null, { verifyToken: 'secret' })).toBe('ch123');
  });

  it('returns null when token mismatches', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': 'ch' } };
    expect(metaCloud.verifyGetChallenge(req, null, { verifyToken: 'correct' })).toBeNull();
  });

  it('returns null when no verifyToken configured', async () => {
    const { default: metaCloud } = await import('./drivers/meta-cloud.js');
    const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'tok', 'hub.challenge': 'ch' } };
    expect(metaCloud.verifyGetChallenge(req, null, {})).toBeNull();
  });
});

// ─── getLogs ──────────────────────────────────────────────────────────────────

describe('getLogs', () => {
  const sampleLogs = [
    {
      id: 'log-1',
      channel: 'EMAIL',
      recipient: 'p***@x.com',
      subject: 'Test',
      status: 'SENT',
      source: 'test',
      provider_ref: null,
      error: null,
      attempts: 1,
      sent_at: null,
      delivered_at: null,
      created_at: new Date(),
      provider: null,
    },
  ];

  beforeEach(() => {
    prisma.integrationLog.findMany = vi.fn().mockResolvedValue(sampleLogs);
    prisma.integrationLog.count = vi.fn().mockResolvedValue(1);
  });

  it('returns logs with pagination', async () => {
    const { req, res, next } = makeReqRes({ query: {} });
    req.user = { id: 'u1' };
    await getLogs(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    const json = res.json.mock.calls[0][0];
    expect(json.data.logs).toHaveLength(1);
    expect(json.data.pagination.total).toBe(1);
  });

  it('filters by channel', async () => {
    const { req, res, next } = makeReqRes({ query: { channel: 'SMS' } });
    req.user = { id: 'u1' };
    await getLogs(req, res, next);
    expect(prisma.integrationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ channel: 'SMS' }) }),
    );
  });

  it('filters by status', async () => {
    const { req, res, next } = makeReqRes({ query: { status: 'FAILED' } });
    req.user = { id: 'u1' };
    await getLogs(req, res, next);
    expect(prisma.integrationLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'FAILED' }) }),
    );
  });

  it('filters by date range', async () => {
    const { req, res, next } = makeReqRes({ query: { from: '2026-01-01', to: '2026-12-31' } });
    req.user = { id: 'u1' };
    await getLogs(req, res, next);
    const whereArg = prisma.integrationLog.findMany.mock.calls[0][0].where;
    expect(whereArg.created_at.gte).toBeInstanceOf(Date);
    expect(whereArg.created_at.lte).toBeInstanceOf(Date);
  });

  it('recipient remains masked (no decryption)', async () => {
    const { req, res, next } = makeReqRes({ query: {} });
    req.user = { id: 'u1' };
    await getLogs(req, res, next);
    const json = res.json.mock.calls[0][0];
    expect(json.data.logs[0].recipient).toBe('p***@x.com');
  });
});
