/**
 * getActiveProvider must refuse (return null = feature unconfigured) a provider whose
 * base_url points at a non-public host, except the self-hosted whisper-local driver.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { prismaMock, guardMock } = vi.hoisted(() => ({
  prismaMock: { aiProvider: { findFirst: vi.fn() } },
  guardMock: vi.fn(),
}));
vi.mock('../../src/config/database.js', () => ({ prisma: prismaMock }));
vi.mock('../../src/shared/utils/crypto.js', () => ({ decrypt: () => JSON.stringify({ api_key: 'k' }) }));
vi.mock('../../src/shared/utils/ssrf-guard.js', () => ({ assertPublicEndpoint: guardMock }));
vi.mock('../../src/modules/media/ai/drivers/index.js', () => ({
  FEATURES: { vision: {}, image_ops: {}, speech_to_text: {} },
  getDriver: (name) => ({ driver: name }),
}));

import { getActiveProvider } from '../../src/modules/media/ai/ai-provider.service.js';

const row = (driver, config) => ({ id: 'p1', driver, credentials: 'x', config });

beforeEach(() => {
  vi.clearAllMocks();
  guardMock.mockResolvedValue(undefined);
});

describe('getActiveProvider SSRF guard', () => {
  it('returns the provider when base_url is public', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(row('openrouter-vision', { base_url: 'https://openrouter.ai/api/v1' }));
    const p = await getActiveProvider('vision');
    expect(p?.driver).toEqual({ driver: 'openrouter-vision' });
    expect(guardMock).toHaveBeenCalledWith('https://openrouter.ai/api/v1');
  });

  it('fails closed (null) when the guard rejects the base_url', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(row('replicate', { base_url: 'http://redis:6379' }));
    guardMock.mockRejectedValue(new Error('SSRF guard: private address'));
    expect(await getActiveProvider('image_ops')).toBeNull();
  });

  it('does not guard whisper-local (private self-hosted endpoint is its purpose)', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(row('whisper-local', { base_url: 'http://10.0.0.5:9000' }));
    const p = await getActiveProvider('speech_to_text');
    expect(p).not.toBeNull();
    expect(guardMock).not.toHaveBeenCalled();
  });

  it('skips the guard when no base_url is configured (driver default)', async () => {
    prismaMock.aiProvider.findFirst.mockResolvedValue(row('replicate', {}));
    expect(await getActiveProvider('image_ops')).not.toBeNull();
    expect(guardMock).not.toHaveBeenCalled();
  });
});
