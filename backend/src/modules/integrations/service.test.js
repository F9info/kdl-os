import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../config/database.js', () => ({
  prisma: {
    integrationLog: { create: vi.fn(), update: vi.fn() },
    integrationProvider: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock('../../middleware/module-gate.js', () => ({
  getModuleStatus: vi.fn(),
}));

vi.mock('./integrations.queue.js', () => ({
  integrationsQueue: {
    add: vi.fn(),
    getWaitingCount: vi.fn(),
    close: vi.fn(),
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
  Queue: vi.fn().mockImplementation(() => ({ add: vi.fn(), getWaitingCount: vi.fn(), close: vi.fn() })),
}));

vi.mock('../../shared/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../user-management/shared/activity-logger.js', () => ({
  writeActivityAsync: vi.fn(),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Import after all mocks
const { prisma } = await import('../../config/database.js');
const { getModuleStatus } = await import('../../middleware/module-gate.js');
const { integrationsQueue } = await import('./integrations.queue.js');
const { getDriver } = await import('./drivers/index.js');
const { decrypt } = await import('./shared/crypto.js');
const { dispatchMessage, IntegrationsDisabledError, maskRecipient, scrubPii } = await import('./service.js');
const { processIntegrationJob } = await import('./integrations.worker.js');
const { createProvider, updateProvider, deleteProvider } = await import('./controller.js');

afterEach(() => {
  vi.clearAllMocks();
});

// ─── scrubPii ─────────────────────────────────────────────────────────────────

describe('scrubPii', () => {
  it('redacts email addresses', () => {
    expect(scrubPii('Send to user@example.com please')).toBe('Send to [email] please');
  });

  it('redacts password= patterns', () => {
    expect(scrubPii('Your password=hunter2 has been reset')).toBe('Your password=[redacted] has been reset');
  });

  it('passes through clean text unchanged', () => {
    expect(scrubPii('Hello world')).toBe('Hello world');
  });

  it('handles null/undefined gracefully', () => {
    expect(scrubPii(null)).toBeNull();
    expect(scrubPii(undefined)).toBeUndefined();
  });
});

// ─── maskRecipient ────────────────────────────────────────────────────────────

describe('maskRecipient', () => {
  it('masks email: first char + *** + @domain', () => {
    expect(maskRecipient('prasanna@example.com')).toBe('p***@example.com');
  });

  it('masks phone: first 2 + 5 stars + last 3', () => {
    expect(maskRecipient('9876543210')).toBe('98*****210');
  });

  it('handles short phone (≤5 digits) with all stars', () => {
    expect(maskRecipient('12345')).toBe('*****');
  });
});

// ─── dispatchMessage ──────────────────────────────────────────────────────────

describe('dispatchMessage — disabled module', () => {
  it('throws IntegrationsDisabledError when module not ENABLED', async () => {
    getModuleStatus.mockResolvedValue('DISABLED');
    await expect(
      dispatchMessage({ channel: 'EMAIL', to: 'x@y.com', body: 'hi', source: 'test' }),
    ).rejects.toThrow(IntegrationsDisabledError);
  });
});

describe('dispatchMessage — enabled module', () => {
  beforeEach(() => {
    getModuleStatus.mockResolvedValue('ENABLED');
    prisma.integrationLog.create.mockResolvedValue({ id: 'log-1' });
    integrationsQueue.add.mockResolvedValue({ id: 'job-1' });
  });

  it('creates QUEUED log with masked recipient', async () => {
    await dispatchMessage({ channel: 'EMAIL', to: 'prasanna@x.com', body: 'hello', source: 'auth' });
    expect(prisma.integrationLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recipient: 'p***@x.com', status: 'QUEUED' }),
      }),
    );
  });

  it('enqueues BullMQ job with correct data', async () => {
    await dispatchMessage({ channel: 'SMS', to: '9876543210', body: 'code', source: 'notifications' });
    expect(integrationsQueue.add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ channel: 'SMS', to: '9876543210', logId: 'log-1' }),
    );
  });

  it('returns logId', async () => {
    const result = await dispatchMessage({ channel: 'EMAIL', to: 'a@b.com', body: 'x', source: 's' });
    expect(result).toEqual({ logId: 'log-1' });
  });
});

// ─── processIntegrationJob — disabled module park ─────────────────────────────

describe('processIntegrationJob — disabled module parks job', () => {
  it('calls moveToDelayed and returns without sending when module disabled', async () => {
    getModuleStatus.mockResolvedValue('DISABLED');

    const job = {
      id: 'job-park-1',
      data: { logId: 'log-1', channel: 'EMAIL', to: 'x@y.com', body: 'b', source: 's', meta: null },
      attemptsMade: 0,
      opts: { attempts: 4 },
      moveToDelayed: vi.fn().mockResolvedValue(undefined),
    };

    await processIntegrationJob(job, 'token-abc');

    expect(job.moveToDelayed).toHaveBeenCalled();
    expect(prisma.integrationLog.update).not.toHaveBeenCalled();
  });
});

// ─── processIntegrationJob — default provider resolution ─────────────────────

describe('processIntegrationJob — default provider resolution', () => {
  const provider = { id: 'prov-1', driver: 'smtp', credentials: 'enc:{"host":"h"}', config: {} };
  const mockDriver = { send: vi.fn() };

  beforeEach(() => {
    getModuleStatus.mockResolvedValue('ENABLED');
    prisma.integrationLog.update.mockResolvedValue({});
    prisma.integrationProvider.findFirst.mockResolvedValue(provider);
    prisma.integrationProvider.findUnique.mockResolvedValue(null);
    getDriver.mockReturnValue(mockDriver);
    decrypt.mockReturnValue('{"host":"h"}');
    mockDriver.send.mockResolvedValue({ provider_ref: 'ref-123' });
  });

  it('resolves default provider when no providerId given', async () => {
    const job = {
      id: 'job-1',
      data: { logId: 'log-1', channel: 'EMAIL', to: 'x@y.com', body: 'b', source: 's', meta: null },
      attemptsMade: 0,
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await processIntegrationJob(job, 'tok');

    expect(prisma.integrationProvider.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ is_default: true }) }),
    );
    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', provider_id: 'prov-1' }) }),
    );
  });

  it('uses specific provider when providerId given (test send)', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue(provider);

    const job = {
      id: 'job-2',
      data: { logId: 'log-2', channel: 'EMAIL', to: 'x@y.com', body: 'b', source: 'test', meta: null, providerId: 'prov-1' },
      attemptsMade: 0,
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await processIntegrationJob(job, 'tok');

    expect(prisma.integrationProvider.findUnique).toHaveBeenCalledWith({ where: { id: 'prov-1' } });
    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
    );
  });
});

// ─── processIntegrationJob — retry → fallback → FAILED ───────────────────────

describe('processIntegrationJob — retry → fallback → FAILED', () => {
  const mainProv = { id: 'main-1', driver: 'msg91', credentials: 'enc:creds', config: {} };
  const fallbackProv = { id: 'fall-1', driver: 'twilio', credentials: 'enc:fcreds', config: {} };
  const failingDriver = { send: vi.fn().mockRejectedValue(new Error('send error')) };
  const failingFallbackDriver = { send: vi.fn().mockRejectedValue(new Error('fallback error')) };

  beforeEach(() => {
    getModuleStatus.mockResolvedValue('ENABLED');
    prisma.integrationLog.update.mockResolvedValue({});
    decrypt.mockReturnValue('{"key":"val"}');
  });

  it('on last attempt with fallback: tries fallback, marks FAILED if fallback also fails', async () => {
    prisma.integrationProvider.findFirst
      .mockResolvedValueOnce(mainProv)   // default provider
      .mockResolvedValueOnce(fallbackProv); // fallback provider
    getDriver
      .mockReturnValueOnce(failingDriver)        // main
      .mockReturnValueOnce(failingFallbackDriver); // fallback

    const job = {
      id: 'job-retry',
      data: { logId: 'log-r', channel: 'SMS', to: '9999999999', body: 'hi', source: 's', meta: null },
      attemptsMade: 3, // last of 4 attempts
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await expect(processIntegrationJob(job, 'tok')).rejects.toThrow('fallback error');

    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error: 'fallback error' }) }),
    );
  });

  it('on last attempt with no fallback: marks FAILED with main error', async () => {
    prisma.integrationProvider.findFirst
      .mockResolvedValueOnce(mainProv)
      .mockResolvedValueOnce(null); // no fallback
    getDriver.mockReturnValue(failingDriver);

    const job = {
      id: 'job-nofallback',
      data: { logId: 'log-nf', channel: 'SMS', to: '1234567890', body: 'hi', source: 's', meta: null },
      attemptsMade: 3,
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await expect(processIntegrationJob(job, 'tok')).rejects.toThrow('send error');

    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED', error: 'send error' }) }),
    );
  });

  it('non-last attempt: does NOT mark FAILED, re-throws for BullMQ retry', async () => {
    prisma.integrationProvider.findFirst.mockResolvedValue(mainProv);
    getDriver.mockReturnValue(failingDriver);

    const job = {
      id: 'job-mid',
      data: { logId: 'log-mid', channel: 'EMAIL', to: 'x@y.com', body: 'b', source: 's', meta: null },
      attemptsMade: 1, // not last
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await expect(processIntegrationJob(job, 'tok')).rejects.toThrow('send error');

    const failedCall = prisma.integrationLog.update.mock.calls.find(
      (c) => c[0].data?.status === 'FAILED',
    );
    expect(failedCall).toBeUndefined();
  });

  it('on last attempt with fallback succeeding: marks SENT via fallback', async () => {
    const workingFallbackDriver = { send: vi.fn().mockResolvedValue({ provider_ref: 'fb-ref' }) };
    prisma.integrationProvider.findFirst
      .mockResolvedValueOnce(mainProv)
      .mockResolvedValueOnce(fallbackProv);
    getDriver
      .mockReturnValueOnce(failingDriver)
      .mockReturnValueOnce(workingFallbackDriver);

    const job = {
      id: 'job-fb-ok',
      data: { logId: 'log-fb', channel: 'SMS', to: '9999999999', body: 'hi', source: 's', meta: null },
      attemptsMade: 3,
      opts: { attempts: 4 },
      moveToDelayed: vi.fn(),
    };

    await processIntegrationJob(job, 'tok');

    expect(prisma.integrationLog.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT', provider_id: 'fall-1', provider_ref: 'fb-ref' }),
      }),
    );
  });
});

// ─── createProvider — one-default-per-channel 409 ────────────────────────────

describe('createProvider — one-default-per-channel 409', () => {
  function makeReqRes(body = {}, params = {}) {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return {
      req: { body, params, user: { id: 'u1' }, headers: {}, ip: '127.0.0.1' },
      res,
      next: vi.fn(),
    };
  }

  const validSmtpCreds = { host: 'smtp.test.com', port: 587, user: 'u@test.com', pass: 'secret' };

  it('returns 409 when a default provider for the channel already exists', async () => {
    getDriver.mockReturnValue({
      channel: 'EMAIL',
      credentialsSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: validSmtpCreds }) },
      configSchema: null,
    });
    prisma.integrationProvider.findFirst.mockResolvedValue({ id: 'existing-default' });

    const { req, res, next } = makeReqRes({
      channel: 'EMAIL',
      driver: 'smtp',
      name: 'Test SMTP',
      credentials: validSmtpCreds,
      is_default: true,
    });

    await createProvider(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.integrationProvider.create).not.toHaveBeenCalled();
  });

  it('creates successfully when no existing default', async () => {
    getDriver.mockReturnValue({
      channel: 'EMAIL',
      credentialsSchema: { safeParse: vi.fn().mockReturnValue({ success: true, data: validSmtpCreds }) },
      configSchema: null,
    });
    prisma.integrationProvider.findFirst.mockResolvedValue(null);
    prisma.integrationProvider.create.mockResolvedValue({
      id: 'new-1', channel: 'EMAIL', driver: 'smtp', name: 'Test SMTP',
      config: {}, is_active: false, is_default: true, is_fallback: false,
      created_at: new Date(), updated_at: new Date(),
    });

    const { req, res, next } = makeReqRes({
      channel: 'EMAIL',
      driver: 'smtp',
      name: 'Test SMTP',
      credentials: validSmtpCreds,
      is_default: true,
    });

    await createProvider(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updateProvider — one-default-per-channel 409', () => {
  function makeReqRes(body = {}, params = {}) {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return {
      req: { body, params, user: { id: 'u1' }, headers: {}, ip: '127.0.0.1' },
      res,
      next: vi.fn(),
    };
  }

  it('returns 409 when setting is_default:true conflicts with existing default', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-2', channel: 'SMS', driver: 'msg91', is_default: false,
    });
    prisma.integrationProvider.findFirst.mockResolvedValue({ id: 'prov-1' });

    const { req, res, next } = makeReqRes({ is_default: true }, { id: 'prov-2' });

    await updateProvider(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.integrationProvider.update).not.toHaveBeenCalled();
  });
});

// ─── deleteProvider — 409 with queued jobs ────────────────────────────────────

describe('deleteProvider — 409 when queued jobs exist', () => {
  function makeReqRes(params = {}) {
    const res = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return {
      req: { body: {}, params, user: { id: 'u1' }, headers: {}, ip: '127.0.0.1' },
      res,
      next: vi.fn(),
    };
  }

  it('returns 409 when is_default and jobs are waiting', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-d', name: 'Main', channel: 'EMAIL', driver: 'smtp', is_default: true,
    });
    integrationsQueue.getWaitingCount.mockResolvedValue(3);

    const { req, res, next } = makeReqRes({ id: 'prov-d' });

    await deleteProvider(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.integrationProvider.delete).not.toHaveBeenCalled();
  });

  it('deletes successfully when no queued jobs', async () => {
    prisma.integrationProvider.findUnique.mockResolvedValue({
      id: 'prov-d', name: 'Main', channel: 'EMAIL', driver: 'smtp', is_default: true,
    });
    prisma.integrationProvider.delete.mockResolvedValue({});
    integrationsQueue.getWaitingCount.mockResolvedValue(0);

    const { req, res, next } = makeReqRes({ id: 'prov-d' });

    await deleteProvider(req, res, next);

    expect(prisma.integrationProvider.delete).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
