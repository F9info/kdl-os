import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, decryptMock } = vi.hoisted(() => ({
  prismaMock: {
    aiProvider: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  decryptMock: vi.fn(),
}));
vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/shared/utils/crypto.js', () => ({
  decrypt: decryptMock,
  encrypt: vi.fn((s) => `enc:${s}`),
}));

const svc = await import('../../src/modules/media/ai/ai-provider.service.js');

const makeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = vi.fn((code) => { res.statusCode = code; return res; });
  res.json = vi.fn((body) => { res.body = body; return res; });
  return res;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getActiveProvider', () => {
  it('returns null when no active provider for the feature', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(null);
    expect(await svc.getActiveProvider('vision')).toBeNull();
    expect(prismaMock.aiProvider.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { feature: 'VISION', is_active: true },
    }));
  });

  it('resolves driver + decrypted credentials when configured', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'ai-1', feature: 'VISION', driver: 'openrouter-vision',
      credentials: 'iv:tag:ct', config: { model: 'm' }, is_active: true,
    });
    decryptMock.mockReturnValue(JSON.stringify({ api_key: 'sekret' }));
    const p = await svc.getActiveProvider('vision');
    expect(p.driver.driver).toBe('openrouter-vision');
    expect(p.credentials).toEqual({ api_key: 'sekret' });
    expect(p.config).toEqual({ model: 'm' });
  });

  it('returns null (not throw) on unknown stored driver or undecryptable credentials', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'ai-2', feature: 'VISION', driver: 'gone-driver', credentials: 'x', config: null,
    });
    expect(await svc.getActiveProvider('vision')).toBeNull();

    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'ai-3', feature: 'VISION', driver: 'openrouter-vision', credentials: 'bad', config: null,
    });
    decryptMock.mockImplementation(() => { throw new Error('auth failure'); });
    expect(await svc.getActiveProvider('vision')).toBeNull();
  });

  it('rejects unknown feature with 422', async () => {
    await expect(svc.getActiveProvider('mind_reading')).rejects.toMatchObject({ status: 422 });
  });
});

describe('getFeatureStatus', () => {
  it('flags each feature by active provider presence', async () => {
    prismaMock.aiProvider.findMany.mockResolvedValue([
      { feature: 'VISION', driver: 'openrouter-vision' },
    ]);
    expect(await svc.getFeatureStatus()).toEqual({
      vision: { configured: true, driver: 'openrouter-vision' },
      image_ops: { configured: false, driver: null },
      speech_to_text: { configured: false, driver: null },
      embeddings: { configured: false, driver: null },
    });
  });
});

describe('requireFeature middleware — AI Rules: unconfigured feature → 501', () => {
  it('responds 501 when the feature has no active provider', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(null);
    const res = makeRes();
    const next = vi.fn();
    await svc.requireFeature('speech_to_text')({}, res, next);
    expect(res.statusCode).toBe(501);
    expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('not configured') });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches req.aiProvider and calls next when configured', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue({
      id: 'ai-1', feature: 'SPEECH_TO_TEXT', driver: 'openai-whisper-api',
      credentials: 'iv:tag:ct', config: {},
    });
    decryptMock.mockReturnValue(JSON.stringify({ api_key: 'k' }));
    const req = {};
    const res = makeRes();
    const next = vi.fn();
    await svc.requireFeature('speech_to_text')(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.aiProvider.driver.driver).toBe('openai-whisper-api');
    expect(res.status).not.toHaveBeenCalled();
  });
});
